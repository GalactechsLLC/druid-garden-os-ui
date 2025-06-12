<template>
  <div>
    <!-- Main Chart -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="chart-header q-mb-md">
          <div class="text-h6">
            {{ title }}
            <q-chip v-if="showLiveIndicator" :color="isLive ? 'positive' : 'grey'" text-color="white" size="sm" class="q-ml-sm">
              {{ isLive ? 'LIVE' : 'STATIC' }}
            </q-chip>
          </div>
          <div class="text-caption text-grey-6">
            {{ subtitle }}
          </div>
        </div>

        <!-- Chart Area -->
        <div v-if="shouldShowChart" class="chart-container">
          <canvas ref="chartCanvas" style="max-height: 400px;"></canvas>
        </div>

        <!-- No data state -->
        <div v-else class="no-data-container">
          <q-icon :name="emptyStateIcon" color="grey-5" size="48px" />
          <div class="text-grey q-mt-sm">{{ emptyStateText }}</div>
          <div class="text-caption text-grey-6 q-mt-xs">
            {{ emptyStateSubtext }}
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { PropType } from 'vue';

interface ChartDataPoint {
  timestamp: Date;
  total: number;
  proofs?: number;
  [key: string]: any;
}

interface LegendItem {
  key: string;
  label: string;
  color: string;
}

const props = defineProps({
  // Chart data
  chartData: {
    type: Array as PropType<ChartDataPoint[]>,
    required: true
  },
  // Chart configuration
  title: {
    type: String,
    default: 'Chart'
  },
  subtitle: {
    type: String,
    default: ''
  },
  yAxisLabel: {
    type: String,
    default: 'Values'
  },
  // Legend configuration
  legendItems: {
    type: Array as PropType<LegendItem[]>,
    required: true
  },
  // Data keys for stacked bars (in order from bottom to top)
  dataKeys: {
    type: Array as PropType<string[]>,
    required: true
  },
  // Live indicator
  showLiveIndicator: {
    type: Boolean,
    default: false
  },
  isLive: {
    type: Boolean,
    default: false
  },
  // Empty state
  emptyStateIcon: {
    type: String,
    default: 'bar_chart'
  },
  emptyStateText: {
    type: String,
    default: 'No data available'
  },
  emptyStateSubtext: {
    type: String,
    default: 'Data will appear when available'
  }
});

const chartCanvas = ref<HTMLCanvasElement>();
let chartInstance: any = null;

// Computed properties
const shouldShowChart = computed(() => props.chartData.length > 0);

// Chart management functions
async function createChart() {
  if (!chartCanvas.value || !shouldShowChart.value) return;

  // Dynamically import Chart.js
  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);

  if (chartInstance) {
    chartInstance.destroy();
  }

  const labels = props.chartData.map(point => formatTime(point.timestamp));

  // Create datasets for stacked bars
  const datasets = props.dataKeys.map(key => {
    const legendItem = props.legendItems.find(item => item.key === key);
    return {
      label: legendItem?.label || key,
      data: props.chartData.map(point => point[key] || 0),
      backgroundColor: legendItem?.color || '#999',
      borderColor: legendItem?.color || '#999',
      borderWidth: 1,
      stack: 'plots'
    };
  });

  // Add proof indicators if any exist
  const proofPoints = props.chartData.map((point, index) => {
    if (point.proofs && point.proofs > 0) {
      return {
        x: index,
        y: point.total + Math.max(1, point.total * 0.05) // Slightly above the bar
      };
    }
    return null;
  }).filter(p => p !== null);

  if (proofPoints.length > 0) {
    datasets.push({
      label: 'Proofs Found 🏆',
      data: proofPoints,
      backgroundColor: '#FFC107',
      borderColor: '#FF8F00',
      borderWidth: 2,
      pointStyle: 'triangle',
      pointRadius: 8,
      pointHoverRadius: 10,
      type: 'scatter',
      showLine: false
    } as any);
  }

  const config = {
    type: 'bar' as const,
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: 'Time'
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: props.yAxisLabel
          },
          ticks: {
            stepSize: 1,
            precision: 0,
            callback: function(value: any) {
              if (Number.isInteger(value)) {
                return value;
              }
              return null;
            }
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          callbacks: {
            title: (context: any) => {
              const index = context[0]?.dataIndex;
              if (index !== undefined && props.chartData[index]) {
                return formatDateTime(props.chartData[index].timestamp);
              }
              return '';
            },
            afterBody: (context: any) => {
              const index = context[0]?.dataIndex;
              if (index !== undefined && props.chartData[index]) {
                const point = props.chartData[index];
                const lines = [];
                if (point.proofs && point.proofs > 0) {
                  lines.push(`🏆 Proofs Found: ${point.proofs}`);
                }
                lines.push(`📊 Total ${props.yAxisLabel}: ${point.total}`);
                return lines;
              }
              return [];
            }
          }
        }
      }
    }
  };

  chartInstance = new Chart(chartCanvas.value, config as any);
  console.log('📊 Chart created with', props.chartData.length, 'data points');
}

function updateChart() {
  if (!chartInstance || !shouldShowChart.value) return;

  console.log('📊 Updating chart with', props.chartData.length, 'data points');

  // Update labels
  chartInstance.data.labels = props.chartData.map(point => formatTime(point.timestamp));

  // Update datasets
  props.dataKeys.forEach((key, index) => {
    if (chartInstance.data.datasets[index]) {
      chartInstance.data.datasets[index].data = props.chartData.map(point => point[key] || 0);
    }
  });

  // Update proof points
  const proofDatasetIndex = chartInstance.data.datasets.findIndex((ds: any) => ds.label?.includes('Proofs'));
  if (proofDatasetIndex >= 0) {
    const proofPoints = props.chartData.map((point, index) => {
      if (point.proofs && point.proofs > 0) {
        return {
          x: index,
          y: point.total + Math.max(1, point.total * 0.05)
        };
      }
      return null;
    }).filter(p => p !== null);

    chartInstance.data.datasets[proofDatasetIndex].data = proofPoints;
  }

  chartInstance.update('none');
}

// Formatting functions
function formatTime(timestamp: Date): string {
  return timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function formatDateTime(timestamp: Date): string {
  return timestamp.toLocaleString();
}

// Watchers
watch(() => props.chartData, () => {
  console.log('📊 Chart data changed, length:', props.chartData.length);
  if (chartInstance && shouldShowChart.value) {
    updateChart();
  } else if (!chartInstance && shouldShowChart.value) {
    nextTick(() => {
      createChart();
    });
  }
}, { deep: true });

watch(() => shouldShowChart.value, (show) => {
  console.log('📊 Should show chart:', show);
  if (show) {
    nextTick(() => {
      createChart();
    });
  }
});

// Lifecycle
onMounted(() => {
  console.log('📊 Chart component mounted, should show:', shouldShowChart.value);
  if (shouldShowChart.value) {
    nextTick(() => {
      createChart();
    });
  }
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});
</script>

<style scoped>
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-container {
  background: white;
  border-radius: 4px;
  padding: 16px;
  height: 400px;
  position: relative;
}

.no-data-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #666;
}
</style>