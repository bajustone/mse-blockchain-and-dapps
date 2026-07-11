<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, class: className = '', ...rest }: { children?: Snippet; class?: string } = $props();
</script>

<span class={`shad-badge ${className}`} {...rest}>{@render children?.()}</span>
