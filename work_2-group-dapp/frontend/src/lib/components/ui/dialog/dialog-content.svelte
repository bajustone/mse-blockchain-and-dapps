<script lang="ts">
  import { getContext } from 'svelte';
  import type { Snippet } from 'svelte';

  type Ctx = { open: boolean; setOpen(value: boolean): void };
  const ctx = getContext<Ctx>('shad-dialog');

  let { children, class: className = '' }: { children?: Snippet; class?: string } = $props();
</script>

{#if ctx.open}
  <div class="modal-backdrop">
    <button class="modal-dismiss" type="button" aria-label="Close dialog" onclick={() => ctx.setOpen(false)}></button>
    <div class={`modal shad-dialog-content ${className}`} role="dialog" aria-modal="true">
      <button class="modal-close" type="button" onclick={() => ctx.setOpen(false)}>×</button>
      {@render children?.()}
    </div>
  </div>
{/if}
