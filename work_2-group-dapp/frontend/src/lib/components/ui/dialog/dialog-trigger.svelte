<script lang="ts">
  import { getContext } from 'svelte';
  import type { Snippet } from 'svelte';

  type Ctx = { setOpen(value: boolean): void };
  const ctx = getContext<Ctx>('shad-dialog');

  let { children, class: className = '' }: { children?: Snippet; class?: string } = $props();
</script>

<button class={`shad-button shad-button-default ${className}`} type="button" onclick={() => ctx.setOpen(true)}>
  {@render children?.()}
</button>
