<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Label from '@/components/ui/Label.vue'

const password = ref('')
const done = ref(false)
</script>

<template>
  <div class="mx-auto max-w-sm">
    <Card class="p-6">
    <h1 class="text-xl font-semibold">Nouveau mot de passe</h1>
    <form v-if="!done" class="mt-6 space-y-4" @submit.prevent="done = true">
      <div class="space-y-2">
        <Label>Mot de passe</Label>
        <Input v-model="password" type="password" required />
      </div>
      <Button type="submit" class="w-full">Enregistrer</Button>
    </form>
    <p v-else class="mt-6 text-sm">Mot de passe mis à jour (simulation).</p>
    <RouterLink to="/login" class="mt-4 inline-block text-sm text-muted-foreground">Connexion</RouterLink>
  </Card>
  </div>
</template>
