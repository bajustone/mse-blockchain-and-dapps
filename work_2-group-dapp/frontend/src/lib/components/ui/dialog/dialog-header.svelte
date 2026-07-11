<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, class: className = '' }: { children?: Snippet; class?: string } = $props();
</script>

<div class={`shad-dialog-header ${className}`}>{@render children?.()}</div>
