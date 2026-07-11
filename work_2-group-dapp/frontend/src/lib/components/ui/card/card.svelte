<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, class: className = '', ...rest }: { children?: Snippet; class?: string } = $props();
</script>

<div class={`shad-card ${className}`} {...rest}>{@render children?.()}</div>
