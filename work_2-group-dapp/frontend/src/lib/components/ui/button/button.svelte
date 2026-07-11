<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    children?: Snippet;
    class?: string;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    title?: string;
    onclick?: (event: MouseEvent) => void;
    [key: string]: unknown;
  };

  let {
    children,
    class: className = '',
    variant = 'default',
    size = 'default',
    type = 'button',
    disabled = false,
    title,
    onclick,
    ...rest
  }: Props = $props();
</script>

<button
  class={`shad-button shad-button-${variant} shad-button-${size} ${className}`}
  {type}
  {disabled}
  {title}
  {onclick}
  {...rest}
>
  {@render children?.()}
</button>
