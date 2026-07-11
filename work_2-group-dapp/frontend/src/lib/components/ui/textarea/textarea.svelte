<script lang="ts">
  type Props = {
    value?: string;
    class?: string;
    rows?: number;
    required?: boolean;
    placeholder?: string;
  };

  let { value = $bindable(''), class: className = '', rows, required = false, placeholder, ...rest }: Props = $props();
</script>

<textarea class={`shad-textarea ${className}`} bind:value {rows} {required} {placeholder} {...rest}></textarea>
