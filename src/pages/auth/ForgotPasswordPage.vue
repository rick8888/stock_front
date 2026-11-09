<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Label from '@/components/ui/Label.vue'

const email = ref('')
const sent = ref(false)
</script>

<template>
  <div class="mx-auto max-w-sm">
    <Card class="p-6">
    <h1 class="text-xl font-semibold">Mot de passe oublié</h1>
    <p class="mt-1 text-sm text-muted-foreground">Nous enverrons un lien de réinitialisation (simulation).</p>
    <form v-if="!sent" class="mt-6 space-y-4" @submit.prevent="sent = true">
      <div class="space-y-2">
        <Label>Email</Label>
        <Input v-model="email" type="email" required />
      </div>
      <Button type="submit" class="w-full">Envoyer</Button>
    </form>
    <p v-else class="mt-6 text-sm">Lien envoyé vers {{ email }}. Utilisez /reset-password.</p>
    <RouterLink to="/login" class="mt-4 inline-block text-sm text-muted-foreground">Retour</RouterLink>
  </Card>
  </div>
</template>
