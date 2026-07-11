import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const PINATA_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

function ipfsUri(hash: string) {
  return `ipfs://${hash}`;
}

async function pinFile(file: File, jwt: string) {
  const body = new FormData();
  body.append('file', file, file.name || 'campaign-asset');
  body.append('pinataMetadata', JSON.stringify({ name: file.name || 'campaign-asset' }));

  const response = await fetch(PINATA_FILE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`IPFS file upload failed: ${message || response.statusText}`);
  }

  return response.json() as Promise<{ IpfsHash: string }>;
}

async function pinJson(content: Record<string, unknown>, title: string, jwt: string) {
  const response = await fetch(PINATA_JSON_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pinataMetadata: { name: `${title || 'BlockFunds Campaign'} metadata` },
      pinataContent: content
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`IPFS metadata upload failed: ${message || response.statusText}`);
  }

  return response.json() as Promise<{ IpfsHash: string }>;
}

export const POST: RequestHandler = async ({ request }) => {
  const jwt = env.PINATA_JWT;
  if (!jwt) {
    return json(
      {
        error: 'IPFS upload is not configured. Set PINATA_JWT on the SvelteKit server, or paste an existing ipfs:// metadata URI manually.'
      },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const targetEth = String(form.get('targetEth') ?? '').trim();
  const durationDays = String(form.get('durationDays') ?? '').trim();
  const externalUrl = String(form.get('externalUrl') ?? '').trim();
  const asset = form.get('asset');

  if (!title || !description) {
    return json({ error: 'Campaign title and description are required before uploading metadata.' }, { status: 400 });
  }

  try {
    let assetURI = '';
    if (asset instanceof File && asset.size > 0) {
      const pinnedAsset = await pinFile(asset, jwt);
      assetURI = ipfsUri(pinnedAsset.IpfsHash);
    }

    const metadata = {
      name: title,
      description,
      image: assetURI || undefined,
      external_url: externalUrl || undefined,
      attributes: [
        { trait_type: 'Target ETH', value: targetEth || 'Not specified' },
        { trait_type: 'Duration days', value: durationDays || 'Not specified' },
        { trait_type: 'Application', value: 'BlockFunds' },
        { trait_type: 'Network', value: 'Sepolia' }
      ]
    };

    const pinnedMetadata = await pinJson(metadata, title, jwt);

    return json({
      metadataURI: ipfsUri(pinnedMetadata.IpfsHash),
      imageURI: assetURI,
      gatewayURL: `https://gateway.pinata.cloud/ipfs/${pinnedMetadata.IpfsHash}`
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'IPFS upload failed.' }, { status: 502 });
  }
};
