<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useLEDStore } from '@/stores/ledStore';
import { useNotificationStore } from '@/stores/notificationStore';

const notificationStore = useNotificationStore();
const ledStore = useLEDStore();

const saving = ref(false);
const testing = ref<string | null>(null);
const showResetDialog = ref(false);

// Computed properties for easier template access
const currentConfig = computed(() => ledStore.currentBoardConfig?.config);
const currentBoard = computed(() => ledStore.currentBoardConfig);

// Watch for changes and auto-save to localStorage
watch(
    () => [ledStore.boards, ledStore.currentBoard],
    () => {
      ledStore.saveToLocalStorage();
    },
    { deep: true }
);

// Color test methods
const testColorLED = async (color: 'red' | 'green' | 'blue') => {
  if (testing.value) return;

  testing.value = color;
  await ledStore.testColor(color);
  testing.value = null;

  notificationStore.success(`${color.charAt(0).toUpperCase() + color.slice(1)} LED test completed`);
};

// Save configuration
const saveConfig = async () => {
  saving.value = true;

  try {
    const result = await ledStore.saveConfiguration();

    if (result && result.success) {
      notificationStore.success(result.message, {
        icon: 'check_circle'
      });
    } else {
      notificationStore.error(result?.message || 'Failed to save configuration', {
        icon: 'error'
      });
    }
  } catch (error) {
    notificationStore.error('Failed to save configuration', {
      icon: 'error'
    });
  } finally {
    saving.value = false;
  }
};

// Reset to defaults
const resetDefaults = () => {
  showResetDialog.value = true;
};

const confirmReset = () => {
  ledStore.resetToDefaults();
  showResetDialog.value = false;
  notificationStore.info('LED configuration reset to defaults');
};

const cancelReset = () => {
  showResetDialog.value = false;
};
</script>

<template>
  <div class="led-manager">
    <!-- Board Selection and Actions -->
    <div class="q-mb-lg">
      <h6 class="q-mt-none q-mb-md">LED Test Manager</h6>

      <q-card flat bordered class="q-mb-md">
        <q-card-section>
          <div class="row items-center q-gutter-md">
            <div class="col-12 col-md-3">
              <q-select
                  v-model="ledStore.currentBoard"
                  :options="ledStore.availableBoards"
                  label="Select Board"
                  outlined
                  dense
                  emit-value
                  map-options
                  @update:model-value="ledStore.setCurrentBoard"
              />
            </div>

            <div class="col-12 col-md-4" v-if="currentBoard">
              <div class="text-body2 text-grey-7">
                <div><strong>{{ currentBoard.displayName }}</strong></div>
                <div>Red: GPIO {{ currentBoard.pins.red }} | Green: GPIO {{ currentBoard.pins.green }} | Blue: GPIO {{ currentBoard.pins.blue }}</div>
              </div>
            </div>

            <div class="col-12 col-md-5">
              <div class="row q-gutter-sm">
                <div class="col">
                  <q-btn
                      @click="saveConfig"
                      :loading="saving"
                      :disable="testing !== null"
                      color="primary"
                      label="Save Configuration"
                      class="full-width"
                      icon="save"
                  />
                </div>
                <div class="col">
                  <q-btn
                      @click="resetDefaults"
                      :disable="saving || testing !== null"
                      color="orange"
                      label="Reset to Defaults"
                      class="full-width"
                      icon="refresh"
                      outline
                  />
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- LED Test Controls -->
    <div v-if="currentConfig && currentBoard">
      <q-card flat bordered>
        <q-card-section>
          <h6 class="q-mt-none q-mb-md">LED Test Controls</h6>

          <div class="text-body2 text-grey-7 q-mb-md">
            Click the buttons below to test each LED color on your {{ currentBoard.displayName }}.
            The LEDs will light up briefly to verify they're working correctly.
          </div>

          <div class="row q-gutter-md">
            <!-- Red LED Test -->
            <div class="col">
              <q-card flat bordered class="led-test-card">
                <q-card-section class="text-center">
                  <div class="led-color-indicator red-led q-mb-md"></div>
                  <div class="text-h6 q-mb-sm">Red LED</div>
                  <div class="text-body2 text-grey-7 q-mb-md">
                    GPIO Pin: {{ currentBoard.pins.red }}
                  </div>
                  <q-btn
                      @click="testColorLED('red')"
                      :loading="testing === 'red'"
                      :disable="testing !== null"
                      color="red"
                      label="Test Red"
                      size="lg"
                      class="full-width"
                      icon="lightbulb"
                  />
                </q-card-section>
              </q-card>
            </div>

            <!-- Green LED Test -->
            <div class="col">
              <q-card flat bordered class="led-test-card">
                <q-card-section class="text-center">
                  <div class="led-color-indicator green-led q-mb-md"></div>
                  <div class="text-h6 q-mb-sm">Green LED</div>
                  <div class="text-body2 text-grey-7 q-mb-md">
                    GPIO Pin: {{ currentBoard.pins.green }}
                  </div>
                  <q-btn
                      @click="testColorLED('green')"
                      :loading="testing === 'green'"
                      :disable="testing !== null"
                      color="green"
                      label="Test Green"
                      size="lg"
                      class="full-width"
                      icon="lightbulb"
                  />
                </q-card-section>
              </q-card>
            </div>

            <!-- Blue LED Test -->
            <div class="col">
              <q-card flat bordered class="led-test-card">
                <q-card-section class="text-center">
                  <div class="led-color-indicator blue-led q-mb-md"></div>
                  <div class="text-h6 q-mb-sm">Blue LED</div>
                  <div class="text-body2 text-grey-7 q-mb-md">
                    GPIO Pin: {{ currentBoard.pins.blue }}
                  </div>
                  <q-btn
                      @click="testColorLED('blue')"
                      :loading="testing === 'blue'"
                      :disable="testing !== null"
                      color="blue"
                      label="Test Blue"
                      size="lg"
                      class="full-width"
                      icon="lightbulb"
                  />
                </q-card-section>
              </q-card>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Reset Confirmation Dialog -->
    <q-dialog v-model="showResetDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Reset to Defaults</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          Are you sure you want to reset the LED configuration to default values? This action cannot be undone.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey-7" @click="cancelReset" />
          <q-btn flat label="Reset" color="orange" @click="confirmReset" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Status Message -->
    <div class="q-mt-md" v-if="testing">
      <q-banner class="bg-info text-white">
        <template v-slot:avatar>
          <q-spinner color="white" size="2em" />
        </template>
        Testing {{ testing }} LED on {{ currentBoard?.displayName }}... Please verify the LED lights up correctly.
      </q-banner>
    </div>
  </div>
</template>

<style scoped>
.led-manager {
  max-width: 1200px;
}

.led-test-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.led-test-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.led-color-indicator {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin: 0 auto;
  border: 3px solid #ddd;
  position: relative;
}

.red-led {
  background: linear-gradient(135deg, #ff6b6b, #ff5252);
}

.green-led {
  background: linear-gradient(135deg, #51cf66, #4caf50);
}

.blue-led {
  background: linear-gradient(135deg, #4dabf7, #2196f3);
}

.led-color-indicator::after {
  content: '';
  position: absolute;
  top: 15%;
  left: 20%;
  width: 25%;
  height: 25%;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  filter: blur(2px);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .led-test-card {
    margin-bottom: 16px;
  }
}
</style>