<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Moon, Sun } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'

const isDark = ref(false)

function syncFromDom() {
  isDark.value = document.documentElement.classList.contains('dark')
}

function applyTheme(dark: boolean) {
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('aria-theme', dark ? 'dark' : 'light')
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (meta) meta.content = dark ? '#11131a' : '#f5f6f8'
}

function toggleTheme() {
  applyTheme(!isDark.value)
}

onMounted(() => {
  syncFromDom()
})
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    :aria-label="isDark ? 'Passer en mode clair' : 'Passer en mode sombre'"
    :title="isDark ? 'Mode clair' : 'Mode sombre'"
    @click="toggleTheme"
  >
    <Sun v-if="isDark" class="size-3.5" />
    <Moon v-else class="size-3.5" />
  </Button>
</template>
