<script setup lang="ts">
import Alert from '@/components/ui/Alert.vue'
defineProps<{ message: string }>()
</script>

<template>
  <Alert variant="destructive">{{ message }}</Alert>
</template>
