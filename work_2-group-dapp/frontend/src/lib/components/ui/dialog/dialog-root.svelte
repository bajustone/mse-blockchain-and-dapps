<script lang="ts">
  import { setContext } from 'svelte';
  import type { Snippet } from 'svelte';

  let { open = $bindable(false), children }: { open?: boolean; children?: Snippet } = $props();

  setContext('shad-dialog', {
    get open() {
      return open;
    },
    setOpen(value: boolean) {
      open = value;
    }
  });
</script>

{@render children?.()}
