<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, class: className = '' }: { children?: Snippet; class?: string } = $props();
</script>

<h2 class={`shad-dialog-title ${className}`}>{@render children?.()}</h2>
