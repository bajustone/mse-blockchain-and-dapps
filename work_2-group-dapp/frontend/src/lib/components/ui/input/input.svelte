<script lang="ts">
  type Props = {
    value?: string;
    class?: string;
    placeholder?: string;
    required?: boolean;
    inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  };

  let { value = $bindable(''), class: className = '', placeholder, required = false, inputmode, ...rest }: Props = $props();
</script>

<input class={`shad-input ${className}`} bind:value {placeholder} {required} {inputmode} {...rest} />
