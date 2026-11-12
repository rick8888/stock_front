<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { contactService } from '@/services/contact.service'

const form = reactive({
  name: '',
  email: '',
  company: '',
  phone: '',
  message: '',
})
const sending = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)
const scrolled = ref(false)

let previousTheme: string | null = null
let previousDark = false

function onScroll() {
  scrolled.value = window.scrollY > 24
}

function forceDark() {
  previousTheme = localStorage.getItem('aria-theme')
  previousDark = document.documentElement.classList.contains('dark')
  document.documentElement.classList.add('dark')
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (meta) meta.content = '#11131a'
}

function restoreTheme() {
  if (previousTheme === 'light' || previousTheme === 'dark') {
    document.documentElement.classList.toggle('dark', previousTheme === 'dark')
  } else {
    document.documentElement.classList.toggle('dark', previousDark)
  }
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (meta) meta.content = document.documentElement.classList.contains('dark') ? '#11131a' : '#f5f6f8'
}

onMounted(() => {
  forceDark()
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  restoreTheme()
})

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function submit() {
  sending.value = true
  error.value = null
  try {
    await contactService.submit({
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim() || undefined,
      phone: form.phone.trim() || undefined,
      message: form.message.trim(),
    })
    sent.value = true
    form.name = ''
    form.email = ''
    form.company = ''
    form.phone = ''
    form.message = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Envoi impossible.'
  } finally {
    sending.value = false
  }
}

const features = [
  {
    title: 'Réapprovisionnement',
    text: 'Suggestions calculées (demande, délai, stock de sécurité) et simulation service level — sans promesse ML.',
  },
  {
    title: 'Alerte → action',
    text: 'Stock bas, OA en retard, DLC : un CTA métier ouvre la DA, le BR ou la fiche stock.',
  },
  {
    title: 'Achats & sourcing',
    text: 'Score fournisseur dynamique (fiabilité déclarée + ponctualité OA) pour choisir avant le devis.',
  },
  {
    title: 'Tournées & POD',
    text: 'Aide ordre & flotte par règles ops, suivi live, preuve de livraison chauffeur.',
  },
]

const flow = ['Détecter', 'Décider', 'Exécuter']
</script>

<template>
  <div class="lp theme-ops">
    <div class="lp-glow" aria-hidden="true" />

    <header class="lp-nav" :class="{ 'lp-nav--solid': scrolled }">
      <a class="lp-brand" href="#top" @click.prevent="scrollTo('top')">
        <span class="lp-mark">B</span>
        <span>BravoStock</span>
      </a>
      <nav class="lp-nav-links" aria-label="Sections">
        <button type="button" @click="scrollTo('activite')">Activité</button>
        <button type="button" @click="scrollTo('fonctions')">Fonctionnalités</button>
        <button type="button" @click="scrollTo('contact')">Contact</button>
      </nav>
      <div class="lp-nav-actions">
        <RouterLink class="lp-link" to="/login">Connexion</RouterLink>
        <button type="button" class="lp-btn lp-btn--primary" @click="scrollTo('contact')">Demander une démo</button>
      </div>
    </header>

    <main>
      <section id="top" class="lp-hero">
        <div class="lp-hero-copy">
          <p class="lp-hero-brand">BravoStock</p>
          <h1 class="lp-hero-title">De l’alerte à l’action.</h1>
          <p class="lp-hero-lead">
            Pilotage stock, achats et tournées pour les équipes ops — règles métier sur vos données, pas un copilote
            génératif.
          </p>
          <div class="lp-hero-cta">
            <button type="button" class="lp-btn lp-btn--primary lp-btn--lg" @click="scrollTo('contact')">
              Parler à un expert
            </button>
            <button type="button" class="lp-btn lp-btn--ghost lp-btn--lg" @click="scrollTo('fonctions')">
              Voir les fonctions
            </button>
          </div>
        </div>

        <div class="lp-hero-stage" aria-hidden="true">
          <div class="lp-product">
            <aside class="lp-product-rail">
              <div class="lp-product-rail-brand">
                <span class="lp-mark lp-mark--sm">B</span>
                <span>BravoStock</span>
              </div>
              <div class="lp-product-rail-item lp-product-rail-item--active">Aujourd’hui</div>
              <div class="lp-product-rail-item">Alertes</div>
              <div class="lp-product-rail-item">Achats</div>
              <div class="lp-product-rail-item">Tournées</div>
            </aside>
            <div class="lp-product-main">
              <div class="lp-product-head">
                <div>
                  <p class="lp-product-kicker">Priorités du jour</p>
                  <p class="lp-product-date">26 août · Casablanca</p>
                </div>
                <span class="lp-pill lp-pill--live">Live</span>
              </div>
              <article class="lp-priority lp-priority--critical">
                <div>
                  <strong>Lait en poudre</strong>
                  <p>Couverture faible · Casa</p>
                </div>
                <span>Créer la DA</span>
              </article>
              <article class="lp-priority lp-priority--warning">
                <div>
                  <strong>OA-1042</strong>
                  <p>Retard Atlas Distribution</p>
                </div>
                <span>Ouvrir le BR</span>
              </article>
              <article class="lp-priority">
                <div>
                  <strong>Tournée Casa</strong>
                  <p>Progression 68 %</p>
                </div>
                <span>Suivre</span>
              </article>
              <div class="lp-progress">
                <div class="lp-progress-fill" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="activite" class="lp-section">
        <p class="lp-kicker">Activité</p>
        <h2 class="lp-h2">La journée opérationnelle, en boucle fermée.</h2>
        <p class="lp-body">
          BravoStock relie magasin, achats et dispatch autour d’une même timeline. Chaque signal — rupture, retard
          fournisseur, DLC, incident tournée — pointe vers l’écran où l’équipe agit.
        </p>
        <ol class="lp-flow">
          <li v-for="(step, index) in flow" :key="step">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <strong>{{ step }}</strong>
          </li>
        </ol>
      </section>

      <section id="fonctions" class="lp-section lp-section--features">
        <p class="lp-kicker">Fonctionnalités</p>
        <h2 class="lp-h2">Ce que vos équipes utilisent vraiment.</h2>
        <ul class="lp-feature-list">
          <li v-for="(item, index) in features" :key="item.title" class="lp-feature">
            <span class="lp-feature-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.text }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section id="contact" class="lp-section lp-contact">
        <div class="lp-contact-intro">
          <p class="lp-kicker">Contact</p>
          <h2 class="lp-h2">Une démo sur votre flux ops.</h2>
          <p class="lp-body">
            Décrivez votre magasin, vos tournées ou votre volume d’achats. On revient avec un parcours adapté — sans
            jargon IA.
          </p>
        </div>

        <form class="lp-form" @submit.prevent="submit">
          <div v-if="sent" class="lp-form-success" role="status">
            Merci — votre message est bien parti. Nous vous recontactons rapidement.
          </div>
          <template v-else>
            <div class="lp-form-grid">
              <label class="lp-field">
                <span>Nom</span>
                <input v-model="form.name" name="name" required autocomplete="name" />
              </label>
              <label class="lp-field">
                <span>Email</span>
                <input v-model="form.email" name="email" type="email" required autocomplete="email" />
              </label>
              <label class="lp-field">
                <span>Entreprise</span>
                <input v-model="form.company" name="company" autocomplete="organization" />
              </label>
              <label class="lp-field">
                <span>Téléphone</span>
                <input v-model="form.phone" name="phone" type="tel" autocomplete="tel" />
              </label>
            </div>
            <label class="lp-field">
              <span>Message</span>
              <textarea v-model="form.message" name="message" rows="5" required maxlength="4000" />
            </label>
            <p v-if="error" class="lp-form-error">{{ error }}</p>
            <button type="submit" class="lp-btn lp-btn--primary lp-btn--lg" :disabled="sending">
              {{ sending ? 'Envoi…' : 'Envoyer' }}
            </button>
          </template>
        </form>
      </section>
    </main>

    <footer class="lp-footer">
      <div class="lp-footer-brand">
        <span class="lp-mark lp-mark--sm">B</span>
        <div>
          <p>BravoStock</p>
          <p>Stock · achats · logistique — règles ops.</p>
        </div>
      </div>
      <RouterLink to="/login">Accéder à l’application</RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.lp {
  position: relative;
  isolation: isolate;
  min-height: 100%;
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  font-feature-settings: 'ss01' on, 'cv11' on;
  letter-spacing: -0.011em;
}

.lp-glow {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(900px 480px at 12% -8%, hsl(var(--primary) / 0.18), transparent 58%),
    radial-gradient(700px 420px at 88% 12%, hsl(var(--info) / 0.1), transparent 55%),
    linear-gradient(180deg, hsl(228 16% 8%) 0%, hsl(var(--background)) 42%, hsl(228 16% 6%) 100%);
}

.lp-nav {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 1.25rem;
  border-bottom: 1px solid transparent;
  transition:
    background 220ms ease,
    border-color 220ms ease,
    backdrop-filter 220ms ease;
}

.lp-nav--solid {
  background: hsl(var(--background) / 0.86);
  border-bottom-color: hsl(var(--border) / 0.9);
  backdrop-filter: blur(12px);
}

.lp-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: hsl(var(--foreground));
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.lp-mark {
  display: inline-flex;
  width: 1.65rem;
  height: 1.65rem;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background: hsl(var(--button));
  color: hsl(var(--button-foreground));
  font-size: 0.7rem;
  font-weight: 700;
}

.lp-mark--sm {
  width: 1.35rem;
  height: 1.35rem;
  font-size: 0.62rem;
}

.lp-nav-links {
  display: none;
  gap: 0.15rem;
  margin-left: 0.35rem;
}

.lp-nav-links button,
.lp-link {
  border: 0;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.4rem 0.65rem;
  cursor: pointer;
  text-decoration: none;
  border-radius: var(--radius);
  transition: color 150ms ease, background 150ms ease;
}

.lp-nav-links button:hover,
.lp-link:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.7);
}

.lp-nav-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font: inherit;
  font-weight: 600;
  font-size: 0.8125rem;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition:
    opacity 150ms ease,
    background 150ms ease,
    border-color 150ms ease,
    color 150ms ease,
    transform 150ms ease;
}

.lp-btn:active {
  transform: translateY(1px);
}

.lp-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}

.lp-btn--primary {
  background: hsl(var(--button));
  color: hsl(var(--button-foreground));
}

.lp-btn--primary:hover {
  opacity: 0.92;
}

.lp-btn--ghost {
  background: transparent;
  border-color: hsl(var(--border));
  color: hsl(var(--foreground));
}

.lp-btn--ghost:hover {
  background: hsl(var(--muted) / 0.8);
}

.lp-btn--lg {
  min-height: 2.5rem;
  padding-inline: 1.1rem;
  font-size: 0.875rem;
}

.lp-hero {
  min-height: min(100vh, 920px);
  display: grid;
  grid-template-columns: 1fr;
  align-items: end;
  gap: 1.75rem;
  padding: 5.25rem 1.25rem 2rem;
  position: relative;
  overflow: hidden;
}

.lp-hero-copy {
  position: relative;
  z-index: 2;
  max-width: 36rem;
  animation: lp-rise 700ms ease both;
}

.lp-hero-brand {
  margin: 0;
  font-size: clamp(2.55rem, 8.2vw, 4.75rem);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 0.94;
  color: hsl(var(--foreground));
}

.lp-hero-title {
  margin: 1rem 0 0;
  font-size: clamp(1.45rem, 3.8vw, 2.05rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.18;
  color: hsl(var(--foreground));
}

.lp-hero-lead {
  margin: 0.9rem 0 0;
  font-size: 0.98rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  max-width: 32rem;
}

.lp-hero-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.55rem;
}

.lp-hero-stage {
  position: relative;
  z-index: 1;
  margin: 0 -1.25rem -2rem;
  padding: 1.35rem 1.25rem 1.75rem;
  animation: lp-stage 900ms 100ms ease both;
}

.lp-product {
  display: grid;
  grid-template-columns: 1fr;
  overflow: hidden;
  border: 1px solid hsl(var(--border) / 0.9);
  border-radius: calc(var(--radius) + 2px);
  background: hsl(var(--card));
  box-shadow:
    0 0 0 1px hsl(var(--shadow-color) / 0.2),
    0 24px 60px hsl(var(--shadow-color) / 0.35);
}

.lp-product-rail {
  display: none;
  padding: 0.9rem 0.75rem;
  border-right: 1px solid hsl(var(--border) / 0.85);
  background: hsl(var(--sidebar));
}

.lp-product-rail-brand {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0.35rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.lp-product-rail-item {
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius);
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.lp-product-rail-item--active {
  background: hsl(var(--sidebar-active));
  color: hsl(var(--foreground));
  font-weight: 500;
}

.lp-product-main {
  padding: 1rem 1rem 1.1rem;
}

.lp-product-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.lp-product-kicker {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.lp-product-date {
  margin: 0.2rem 0 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.lp-pill {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius);
  border: 1px solid hsl(var(--border));
  padding: 0.2rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.lp-pill--live {
  border-color: hsl(var(--success) / 0.35);
  color: hsl(var(--success));
  background: hsl(var(--success) / 0.1);
}

.lp-priority {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.8rem;
  margin-top: 0.45rem;
  border: 1px solid hsl(var(--border) / 0.8);
  border-left-width: 2px;
  border-radius: var(--radius);
  background: hsl(var(--background) / 0.55);
}

.lp-priority strong {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
}

.lp-priority p {
  margin: 0.15rem 0 0;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.lp-priority > span {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--primary));
}

.lp-priority--critical {
  border-left-color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.08);
}

.lp-priority--warning {
  border-left-color: hsl(var(--warning));
  background: hsl(var(--warning) / 0.08);
}

.lp-progress {
  margin-top: 0.85rem;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: hsl(var(--muted));
}

.lp-progress-fill {
  width: 68%;
  height: 100%;
  background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--success)));
  animation: lp-meter 1.35s 0.35s ease both;
}

.lp-section {
  padding: 4.25rem 1.25rem;
  max-width: 72rem;
  margin: 0 auto;
}

.lp-section--features {
  border-top: 1px solid hsl(var(--border) / 0.85);
}

.lp-kicker {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.lp-h2 {
  margin: 0.55rem 0 0;
  max-width: 16ch;
  font-size: clamp(1.55rem, 3.2vw, 2.2rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: hsl(var(--foreground));
}

.lp-body {
  margin: 0.95rem 0 0;
  max-width: 38rem;
  font-size: 0.95rem;
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
}

.lp-flow {
  list-style: none;
  margin: 2rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}

.lp-flow li {
  display: flex;
  align-items: baseline;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border: 1px solid hsl(var(--border) / 0.85);
  border-radius: var(--radius);
  background: hsl(var(--card) / 0.7);
}

.lp-flow span {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--primary));
}

.lp-flow strong {
  font-size: 0.95rem;
  font-weight: 600;
}

.lp-feature-list {
  list-style: none;
  margin: 2.25rem 0 0;
  padding: 0;
}

.lp-feature {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  padding: 1.35rem 0;
  border-top: 1px solid hsl(var(--border) / 0.85);
}

.lp-feature:last-child {
  border-bottom: 1px solid hsl(var(--border) / 0.85);
}

.lp-feature-index {
  padding-top: 0.15rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--primary));
}

.lp-feature h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.lp-feature p {
  margin: 0.4rem 0 0;
  max-width: 38rem;
  font-size: 0.9rem;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
}

.lp-contact {
  display: grid;
  gap: 1.75rem;
  border-top: 1px solid hsl(var(--border) / 0.85);
}

.lp-form {
  display: grid;
  gap: 0.9rem;
  padding: 1.15rem;
  border: 1px solid hsl(var(--border) / 0.9);
  border-radius: calc(var(--radius) + 2px);
  background: hsl(var(--card));
  box-shadow: 0 1px 0 hsl(var(--shadow-color) / 0.2);
}

.lp-form-grid {
  display: grid;
  gap: 0.9rem;
}

.lp-field {
  display: grid;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.lp-field input,
.lp-field textarea {
  width: 100%;
  border: 1px solid hsl(var(--input));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border-radius: var(--radius);
  padding: 0.65rem 0.75rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 400;
}

.lp-field input:focus,
.lp-field textarea:focus {
  outline: 2px solid hsl(var(--ring) / 0.35);
  border-color: hsl(var(--ring) / 0.7);
}

.lp-form-error {
  margin: 0;
  color: hsl(var(--destructive));
  font-size: 0.8125rem;
}

.lp-form-success {
  padding: 0.85rem 0.15rem;
  font-size: 0.95rem;
  line-height: 1.5;
  color: hsl(var(--success));
}

.lp-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  align-items: center;
  padding: 1.75rem 1.25rem 2.75rem;
  border-top: 1px solid hsl(var(--border) / 0.85);
}

.lp-footer-brand {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}

.lp-footer-brand p:first-child {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.lp-footer-brand p:last-child {
  margin: 0.15rem 0 0;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.lp-footer a {
  margin-left: auto;
  color: hsl(var(--foreground));
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 600;
}

.lp-footer a:hover {
  color: hsl(var(--primary));
}

@keyframes lp-rise {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes lp-stage {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes lp-meter {
  from {
    width: 0;
  }
  to {
    width: 68%;
  }
}

@media (min-width: 720px) {
  .lp-nav {
    padding-inline: 2rem;
  }

  .lp-nav-links {
    display: flex;
  }

  .lp-hero {
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
    align-items: center;
    padding: 6.25rem 2rem 3rem;
    gap: 2rem;
  }

  .lp-hero-stage {
    margin: 0;
    padding: 0;
  }

  .lp-product {
    grid-template-columns: 9.5rem 1fr;
    min-height: 380px;
  }

  .lp-product-rail {
    display: block;
  }

  .lp-product-main {
    padding: 1.15rem 1.2rem 1.25rem;
  }

  .lp-section {
    padding-inline: 2rem;
  }

  .lp-flow {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .lp-contact {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    align-items: start;
  }

  .lp-form {
    padding: 1.35rem;
  }

  .lp-form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .lp-footer {
    padding-inline: 2rem;
  }
}

@media (min-width: 1100px) {
  .lp-hero {
    padding-inline: clamp(2rem, 6vw, 5rem);
  }

  .lp-feature {
    grid-template-columns: 3rem 1fr;
    gap: 1.35rem;
    padding-block: 1.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-hero-copy,
  .lp-hero-stage,
  .lp-progress-fill {
    animation: none;
  }
}
</style>
