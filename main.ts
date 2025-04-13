// src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import { VContainer, VRow, VCol, VCard, VCardTitle, VCardText, VForm, VTextField, VBtn, VAlert, VSelect, VRadioGroup, VRadio, VDialog, VCardActions, VProgressLinear } from 'vuetify/components';
import '@mdi/font/css/materialdesignicons.css';
import './styles.css';
// Poprawiony import (zakładając, że plik jest w src/router/index.ts)
import { router } from './router/index';

const vuetify = createVuetify({
  components: {
    VContainer,
    VRow,
    VCol,
    VCard,
    VCardTitle,
    VCardText,
    VForm,
    VTextField,
    VBtn,
    VAlert,
    VSelect,
    VRadioGroup,
    VRadio,
    VDialog,
    VCardActions,
    VProgressLinear,
  },
});

const app = createApp(App);
app.use(vuetify);
app.use(router);
app.mount('#app');