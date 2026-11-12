<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
</script>

<template>
  <div class="relative flex min-h-full items-center justify-center overflow-y-auto bg-background px-4 py-10">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.06),_transparent_55%)]" />
    <div class="absolute right-3 top-3 z-10 sm:right-5 sm:top-5">
      <ThemeToggle />
    </div>
    <div class="relative w-full max-w-sm">
      <RouterLink to="/accueil" class="mb-7 flex flex-col items-center gap-2.5 text-inherit no-underline">
        <div class="flex size-9 items-center justify-center rounded-md bg-button text-xs font-semibold text-button-foreground">
          B
        </div>
        <div class="text-center">
          <p class="text-base font-semibold tracking-tight">BravoStock</p>
          <p class="mt-1 text-[13px] text-muted-foreground">Votre journée opérationnelle</p>
        </div>
      </RouterLink>
      <RouterView />
    </div>
  </div>
</template>
