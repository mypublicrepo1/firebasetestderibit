<!-- src/App.vue -->
<template>
  <v-app>
    <router-view></router-view>
  </v-app>
</template>

<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
</script>