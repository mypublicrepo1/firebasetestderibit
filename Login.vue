<!-- src/components/Login.vue -->
<template>
  <v-container class="login-container">
    <v-row justify="center">
      <v-col cols="12" sm="6" md="4">
        <v-card>
          <v-card-title class="text-center">Logowanie</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="login">
              <v-text-field
                v-model="password"
                label="Hasło"
                type="password"
                :error-messages="error"
                required
              ></v-text-field>
              <v-btn type="submit" color="primary" block :loading="loading">Zaloguj</v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const password = ref('');
const loading = ref(false);
const error = ref('');

const login = async () => {
  loading.value = true;
  error.value = '';
  try {
    // Prosta serializacja hasła jako zwykły string
    const passwordString = password.value.toString();
    // Utwórz prosty obiekt bez referencji do obiektu ref
    const payload = { password: passwordString };
    
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    let data;
      try {
        data = await response.json();
      } catch (e) {
        error.value = 'Wystąpił błąd podczas logowania';
        throw new Error("Invalid json response");
      }
      if (!response.ok) throw new Error(data.error || 'Nieprawidłowe hasło');
    
      localStorage.setItem('auth', data.token || 'authenticated');

    router.push('/analyzer');
  } catch (err) {
    console.error('Login error:', err.message);
    error.value = 'Wystąpił błąd podczas logowania';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
}
</style>