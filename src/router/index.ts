import { createRouter, createWebHistory } from 'vue-router';
import Login from '../components/Login.vue';
import OptionAnalyzer from '../components/OptionAnalyzer.vue';

const routes = [
  { path: '/login', component: Login },
  { path: '/analyzer', component: OptionAnalyzer },
  { path: '/', redirect: '/login' },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});