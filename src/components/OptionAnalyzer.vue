<!-- src/components/OptionAnalyzer.vue -->
<template>
  <v-container class="option-analyzer">
    <v-alert type="info" class="mb-4">Sugestie są dynamiczne i oparte na aktualnych danych rynkowych</v-alert>

    <v-row class="filters">
      <v-col cols="12" sm="6" md="3">
        <v-select
          v-model="filters.baseAsset"
          :items="['BTC', 'ETH']"
          label="Base Asset"
          @update:modelValue="fetchOptions"
        ></v-select>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-radio-group v-model="filters.optionType" row @update:modelValue="fetchOptions">
          <v-radio label="Call" value="call"></v-radio>
          <v-radio label="Put" value="put"></v-radio>
          <v-radio label="Both" value="both"></v-radio>
        </v-radio-group>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model.number="filters.minIV"
          label="Min IV (%)"
          type="number"
          min="0"
          @input="debouncedFetch"
        ></v-text-field>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model.number="filters.maxIV"
          label="Max IV (%)"
          type="number"
          min="0"
          @input="debouncedFetch"
        ></v-text-field>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model.number="filters.minStrike"
          label="Min Strike"
          type="number"
          min="0"
          @input="debouncedFetch"
        ></v-text-field>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model.number="filters.maxStrike"
          label="Max Strike"
          type="number"
          min="0"
          @input="debouncedFetch"
        ></v-text-field>
      </v-col>
    </v-row>

    <vue-good-table
      :columns="columns"
      :rows="options"
      :sort-options="{ enabled: true }"
      :pagination-options="{ enabled: true, perPage: 10 }"
    >
      <template #table-row="props">
        <span v-if="props.column.field === 'action'">
          <v-btn size="small" @click="addToStrategy(props.row.instrument_name)">Add to Strategy</v-btn>
          <v-btn size="small" color="primary" @click="openOrderModal(props.row)">Wystaw opcje</v-btn>
        </span>
        <span v-else-if="props.column.field === 'strike'">{{ props.row.strike.toFixed(2) }}</span>
        <span v-else-if="props.column.field === 'implied_volatility'" :title="'Implied Volatility'">
          {{ props.row.implied_volatility.toFixed(2) }}
        </span>
        <span v-else-if="props.column.field === 'bid_price'">{{ props.row.bid_price.toFixed(4) }}</span>
        <span v-else-if="props.column.field === 'ask_price'">{{ props.row.ask_price.toFixed(4) }}</span>
        <span v-else-if="props.column.field === 'bid_ask_spread'">{{ props.row.bid_ask_spread.toFixed(2) }}</span>
        <span v-else-if="props.column.field === 'time_to_expiry'">{{ props.row.time_to_expiry.toFixed(2) }}</span>
        <span v-else>{{ props.row[props.column.field] }}</span>
      </template>
    </vue-good-table>

    <v-card v-if="selectedOption" class="summary mt-4">
      <v-card-title>Podsumowanie dla {{ selectedOption.instrument_name }}</v-card-title>
      <v-card-text>
        <p><strong>Premia:</strong> {{ selectedOption.ask_price.toFixed(4) }} {{ selectedOption.base_currency || 'BTC' }}</p>
        <p><strong>Potencjalny zysk:</strong> {{ selectedOption.ask_price.toFixed(4) }} {{ selectedOption.base_currency || 'BTC' }} (maksymalny zysk z premii)</p>
        <p><strong>Potencjalna strata:</strong> 
          {{ selectedOption.option_type === 'call' ? 'Nieograniczona (Call)' : `Max ${(selectedOption.strike - selectedOption.ask_price).toFixed(2)} ${selectedOption.base_currency || 'BTC'} (Put)` }}
        </p>
      </v-card-text>
    </v-card>

    <v-dialog v-model="showModal" max-width="500">
      <v-card>
        <v-card-title>Potwierdź zlecenie</v-card-title>
        <v-card-text>
          <p>Wystawiasz opcję: {{ selectedOption?.instrument_name }}</p>
          <p>Cena: {{ selectedOption?.ask_price.toFixed(4) }} {{ selectedOption?.base_currency || 'BTC' }}</p>
          <v-text-field
            v-model.number="orderAmount"
            label="Ilość"
            type="number"
            min="1"
            step="1"
            required
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="showModal = false">Anuluj</v-btn>
          <v-btn color="primary" @click="placeOrder" :loading="loading">Potwierdź</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate></v-progress-linear>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { VueGoodTable } from 'vue-good-table-next';
import 'vue-good-table-next/dist/vue-good-table-next.css';
import { debounce } from 'lodash';

const filters = ref({
  baseAsset: 'BTC',
  optionType: 'both',
  minIV: 0,
  maxIV: 200,
  minStrike: 0,
  maxStrike: Infinity,
  expiryDates: [],
});

const options = ref([]);
const loading = ref(false);
const error = ref('');
const selectedOption = ref(null);
const showModal = ref(false);
const orderAmount = ref(1);

const columns = [
  { label: 'Strike', field: 'strike' },
  { label: 'Expiry', field: 'expiry' },
  { label: 'IV (%)', field: 'implied_volatility' },
  { label: 'Bid', field: 'bid_price' },
  { label: 'Ask', field: 'ask_price' },
  { label: 'Spread (%)', field: 'bid_ask_spread' },
  { label: 'Days to Expiry', field: 'time_to_expiry' },
  { label: 'Action', field: 'action', sortable: false },
];

const fetchOptions = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch(`/api/getOptions?filters=${encodeURIComponent(JSON.stringify(filters.value))}`);
    if (!response.ok) throw new Error('Failed to fetch options');
    const data = await response.json();
    options.value = data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const debouncedFetch = debounce(fetchOptions, 500);

const addToStrategy = async (instrument_name) => {
  try {
    const response = await fetch('/api/saveStrategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instrument_name }),
    });
    if (!response.ok) throw new Error('Failed to save strategy');
    alert('Added to strategy!');
  } catch (err) {
    error.value = err.message;
  }
};

const openOrderModal = (option) => {
  selectedOption.value = option;
  showModal.value = true;
  orderAmount.value = 1;
};

const placeOrder = async () => {
  if (!selectedOption.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch('/api/placeOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instrument_name: selectedOption.value.instrument_name,
        amount: orderAmount.value,
        price: selectedOption.value.ask_price,
      }),
    });
    if (!response.ok) throw new Error('Failed to place order');
    const { order_id } = await response.json();
    alert(`Order placed! ID: ${order_id}`);
    showModal.value = false;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (!localStorage.getItem('auth')) {
    window.location.href = '/login';
  } else {
    fetchOptions();
    setInterval(fetchOptions, 30000);
  }
});
</script>