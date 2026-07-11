<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, class: className = '' }: { children?: Snippet; class?: string } = $props();
</script>

<p class={`shad-dialog-description ${className}`}>{@render children?.()}</p>
