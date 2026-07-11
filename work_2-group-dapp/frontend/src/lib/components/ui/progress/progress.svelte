<script lang="ts">
  let { value = 0, class: className = '', label }: { value?: number; class?: string; label?: string } = $props();
  const safeValue = $derived(Math.max(0, Math.min(100, value)));
</script>

<div class={`shad-progress ${className}`} aria-label={label} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={safeValue}>
  <div style={`width: ${safeValue}%`}></div>
</div>
