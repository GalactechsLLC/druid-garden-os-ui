<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {usePluginStore} from '@/stores/pluginsStore'
import {useSystemInfoStore} from '@/stores/systemStore.ts'
import {useFilesStore} from '@/stores/filesStore'
import {useNotificationStore} from '@/stores/notificationStore'
import {formatBytes} from '@/utils/format'
import type {MemorySegmentType, NetworkInfo} from '@/types/system'
import Notification from "@/components/Notification.vue";
import {useDiskStore} from "@/stores/diskStore.ts";
import type {DiskInfo, Partition} from "@/types/disk.ts";

const diskStore = useDiskStore()
const pluginStore = usePluginStore()
const systemStore = useSystemInfoStore()
const filesStore = useFilesStore()
const notificationStore = useNotificationStore()

const refreshInterval = ref<number | null>(null)
const lastUpdated = ref<Date | null>(null)
const autoRefresh = ref(true)
const refreshRate = ref(30) // Seconds
const loading = ref(true)
const error = ref<string | null>(null)

const driveStatuses = ref<Array<{
  device: string,
  mountPoint: string,
  size: number,
  used: number,
  usage: number,
  type: string,
  status: 'ok' | 'warning' | 'critical'
}>>([])

const systemOverview = ref({
  hostname: 'Loading...',
  osInfo: 'Loading...',
  uptime: 'Loading...',
  kernelVersion: 'Loading...',
  lastBoot: 'Loading...',
  cpuModel: 'Loading...',
  cpuCores: 0,
  cpuThreads: 0,
  totalMemory: 0,
  totalStorage: 0
})

const networkInterfaces = ref<Array<{
  name: string,
  ipv4: string,
  status: 'up' | 'down',
  speed: number,
  received: number,
  sent: number
}>>([])

const performanceHistory = ref({
  cpu: [] as number[],
  memory: [] as number[],
  network: [] as number[],
  io: [] as number[],
  timeLabels: [] as string[]
})

const processCount = ref(0)

const systemHealth = ref({
  status: 'good' as 'good' | 'warning' | 'critical',
  lastCheck: new Date().toISOString(),
  issues: [] as string[]
})

const totalRunningPlugins = computed(() => pluginStore.runningCount)
const totalEnabledPlugins = computed(() => pluginStore.enabledCount)
const totalPlugins = computed(() => pluginStore.pluginCount)

const systemTemperature = computed(() => {
  if (!systemStore.systemInfo) return 0
  return systemStore.systemInfo.cpu.temperature?.toFixed(2) ?? 0
})

function calculateMemoryPercentage(type: MemorySegmentType): number {
  return systemStore.calculateMemoryPercentage(systemStore.systemInfo?.memory || null, type);
}

const memoryUsage = computed(() => {
  if (!systemStore.systemInfo) return 0
  return parseFloat(systemStore.formatPercentage(calculateMemoryPercentage('used')))
})

const cpuUsage = computed(() => {
  if (!systemStore.systemInfo) return 0
  return systemStore.systemInfo.cpu.usage
})

async function fetchAllData() {
  try {
    loading.value = true
    error.value = null

    // Fetch data from all stores
    await Promise.all([
      pluginStore.fetchPlugins(),
      systemStore.fetchSystemInfo(),
      filesStore.fetchDiskStats(),
      diskStore.fetchDisks(),
      fetchDriveStatuses(),
      fetchNetworkStats(),
      checkSystemHealth()
    ])

    lastUpdated.value = new Date()

    addPerformanceDataPoint()

    loading.value = false
  } catch (err) {
    console.error('Failed to fetch dashboard data:', err)
    error.value = err instanceof Error ? err.message : 'Unknown error occurred'
    loading.value = false
  }
}

async function fetchDriveStatuses() {
  // Fetch disk data from the disk store instead
  await diskStore.fetchDisks()

  if (diskStore.disks) {
    driveStatuses.value = []

    // Process each disk's mounted partitions
    diskStore.disks.forEach((disk: DiskInfo) => {
      if (disk.partitions) {
        disk.partitions.forEach((partition: Partition) => {
          // Only show mounted partitions with valid space info
          if (partition.mount_path && partition.space_info && partition.space_info.total_space > 0) {
            const usedSpace = partition.space_info.used_space
            const totalSpace = partition.space_info.total_space
            const usagePercentage = totalSpace > 0 ? Math.round((usedSpace / totalSpace) * 100) : 0

            let status: 'ok' | 'warning' | 'critical' = 'ok'
            if (usagePercentage > 90) status = 'critical'
            else if (usagePercentage > 75) status = 'warning'

            driveStatuses.value.push({
              device: partition.device,
              mountPoint: partition.mount_path,
              size: totalSpace,
              used: usedSpace,
              usage: usagePercentage,
              type: partition.file_system || 'Unknown',
              status
            })
          }
        })
      }
    })
  }

  if (systemStore.systemInfo) {
    // Calculate total storage from all mounted partitions
    systemOverview.value.totalStorage = driveStatuses.value.reduce((total, drive) => total + drive.size, 0)

    // Update other system info
    systemOverview.value.hostname = systemStore.systemInfo.system.hostname
    systemOverview.value.osInfo = `${systemStore.systemInfo.system.name} ${systemStore.systemInfo.system.os_version}`
    systemOverview.value.uptime = systemStore.formatUptime(systemStore.systemInfo.system.uptime)
    systemOverview.value.kernelVersion = systemStore.systemInfo.system.kernel
    systemOverview.value.lastBoot = new Date(systemStore.systemInfo.system.uptime).toLocaleString()
    systemOverview.value.cpuModel = systemStore.systemInfo.cpu.model
    systemOverview.value.cpuCores = systemStore.systemInfo.cpu.cores
    systemOverview.value.cpuThreads = systemStore.systemInfo.cpu.threads
    systemOverview.value.totalMemory = systemStore.systemInfo.memory.total
  }
}

async function fetchNetworkStats() {
  if (systemStore.systemInfo?.networks) {
    networkInterfaces.value = systemStore.systemInfo.networks.map((networkInfo: NetworkInfo) => ({
      name: networkInfo.name,
      ipv4: networkInfo.ip_addresses && networkInfo.ip_addresses.length > 0
          ? `${networkInfo.ip_addresses[0].address}/${networkInfo.ip_addresses[0].net_mask}`
          : 'No IP',
      status: (networkInfo.ip_addresses && networkInfo.ip_addresses.length > 0) ? 'up' as const : 'down' as const,
      speed: 0,
      received: networkInfo.data_downloaded || 0,
      sent: networkInfo.data_uploaded || 0
    }))
  }

  if (systemStore.systemInfo) {
    processCount.value = systemStore.systemInfo.processes.length
  }
}

function checkSystemHealth() {
  const issues: string[] = []
  let status: 'good' | 'warning' | 'critical' = 'good'

  if (systemTemperature.value as number > 80) {
    issues.push('CPU temperature is critically high')
    status = 'critical'
  } else if (systemTemperature.value as number > 70) {
    issues.push('CPU temperature is high')
    status = 'warning'
  }

  const criticalDisks = driveStatuses.value.filter(d => d.status === 'critical')
  const warningDisks = driveStatuses.value.filter(d => d.status === 'warning')

  if (criticalDisks.length > 0) {
    issues.push(`${criticalDisks.length} disk(s) critically low on space`)
    status = 'critical'
  } else if (warningDisks.length > 0) {
    issues.push(`${warningDisks.length} disk(s) running low on space`)
    status = status === 'critical' ? 'critical' : 'warning'
  }

  if (memoryUsage.value > 90) {
    issues.push('Memory usage is critically high')
    status = 'critical'
  } else if (memoryUsage.value > 80) {
    issues.push('Memory usage is high')
    status = status === 'critical' ? 'critical' : 'warning'
  }

  // Check CPU usage
  if (cpuUsage.value > 90) {
    issues.push('CPU usage is critically high')
    status = 'critical'
  } else if (cpuUsage.value > 80) {
    issues.push('CPU usage is high')
    status = status === 'critical' ? 'critical' : 'warning'
  }

  systemHealth.value = {
    status,
    lastCheck: new Date().toISOString(),
    issues
  }
}

function addPerformanceDataPoint() {
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

  performanceHistory.value.cpu.push(cpuUsage.value)
  performanceHistory.value.memory.push(memoryUsage.value)

  const networkUsage = Math.round(Math.random() * 20 + 10)
  performanceHistory.value.network.push(networkUsage)

  const ioUsage = Math.round(Math.random() * 30 + 5)
  performanceHistory.value.io.push(ioUsage)

  performanceHistory.value.timeLabels.push(timeStr)

  const MAX_HISTORY_POINTS = 20
  if (performanceHistory.value.cpu.length > MAX_HISTORY_POINTS) {
    performanceHistory.value.cpu.shift()
    performanceHistory.value.memory.shift()
    performanceHistory.value.network.shift()
    performanceHistory.value.io.shift()
    performanceHistory.value.timeLabels.shift()
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value

  if (autoRefresh.value) {
    startAutoRefresh()
    notificationStore.notify("positive", `Auto-refresh enabled (${refreshRate.value}s)`, {icon: 'refresh'})
  } else {
    stopAutoRefresh()
    notificationStore.notify("info", 'Auto-refresh disabled', {icon: 'refresh_off'})
  }
}

function startAutoRefresh() {
  if (refreshInterval.value !== null) {
    clearInterval(refreshInterval.value)
  }

  refreshInterval.value = window.setInterval(() => {
    fetchAllData()
  }, refreshRate.value * 1000)
}

function stopAutoRefresh() {
  if (refreshInterval.value !== null) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

function updateRefreshRate(rate: number) {
  refreshRate.value = rate

  if (autoRefresh.value) {
    stopAutoRefresh()
    startAutoRefresh()
    notificationStore.notify("positive", `Refresh rate updated to ${rate}s`, {icon: 'update'})
  }
}
function refreshData() {
  fetchAllData()
  notificationStore.notify("positive", "Dashboard refreshed", {icon: 'refresh'})
}

const memoryUsed = computed(() => {
  if (!systemStore.systemInfo?.memory) return '0 B'
  return systemStore.formatBytes(systemStore.systemInfo.memory.used || 0)
})

const memoryTotal = computed(() => {
  if (!systemStore.systemInfo?.memory) return '0 B'
  return systemStore.formatBytes(systemStore.systemInfo.memory.total || 0)
})

const memoryAvailable = computed(() => {
  if (!systemStore.systemInfo?.memory) return '0 B'
  return systemStore.formatMemorySegment(systemStore.systemInfo.memory, 'available')
})

function getGpuColor(value: number): string {
  if (value >= 90) return 'negative';
  if (value >= 70) return 'warning';
  return 'positive';
}

function getTemperatureColor(temp: number): string {
  if (temp >= 80) return 'negative';
  if (temp >= 70) return 'warning';
  return 'positive';
}

function getTemperaturePercentage(temp: number): number {
  const minTemp = 30;
  const maxTemp = 100;
  return Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
}

onMounted(async () => {
  console.log("Dashboard mounting, fetching initial data...")
  loading.value = true

  try {
    await filesStore.fetchDiskStats()
    await systemStore.fetchSystemInfo()
    await fetchDriveStatuses()
    await fetchAllData()
  } catch (err) {
    console.error("Error during initial data loading:", err)
    error.value = err instanceof Error ? err.message : 'Error loading dashboard data'
  } finally {
    loading.value = false
  }

  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<template>
  <q-page padding>
    <div class="row q-mb-md items-center justify-between">
      <div>
        <h5 class="q-mt-none q-mb-xs">System Dashboard</h5>
        <div class="text-caption text-grey-8" v-if="lastUpdated">
          Last updated: {{ lastUpdated.toLocaleString() }}
        </div>
      </div>

      <div class="row q-gutter-sm">
        <q-select
            v-model="refreshRate"
            :options="[10, 30, 60, 300]"
            label="Refresh rate"
            dense
            outlined
            style="width: 150px"
            @update:model-value="updateRefreshRate"
        >
          <template v-slot:append>
            <q-icon name="timer" />
          </template>
          <template v-slot:option="{ opt }">
            {{ opt }}s
          </template>
          <template v-slot:selected>
            {{ refreshRate }}s
          </template>
        </q-select>

        <q-btn :color="autoRefresh ? 'primary' : 'grey'" icon="autorenew" :label="autoRefresh ? 'Auto' : 'Manual'" @click="toggleAutoRefresh" />
        <q-btn color="primary" icon="refresh" label="Refresh" @click="refreshData" :loading="loading" />
      </div>
    </div>

    <!-- System Health -->
    <div class="row q-col-gutter-md q-mb-md" v-if="systemStore.systemInfo?.system">
      <div class="col-12">
        <q-card>
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">
              <q-icon name="health_and_safety" /> System Health
            </div>
          </q-card-section>

          <!-- Key Statistics -->
          <div class="row q-col-gutter-md q-mb-md key-stats">
            <!-- CPU Usage -->
            <div class="col-12 col-sm-6 col-md-3">
              <q-card class="dashboard-stat-card">
                <q-card-section>
                  <div class="row items-center no-wrap">
                    <div class="col-auto">
                      <q-knob
                          v-model="cpuUsage"
                          :readonly="true"
                          size="85px"
                          :thickness="0.2"
                          :color="cpuUsage > 80 ? 'negative' : cpuUsage > 60 ? 'warning' : 'positive'"
                          track-color="grey-3"
                          :min="0"
                          :max="100"
                          show-value
                      >
                        {{ systemStore.formatPercentage(cpuUsage) }}
                      </q-knob>
                    </div>
                    <div class="col q-ml-md">
                      <div class="text-h6">CPU Usage</div>
                      <div class="text-subtitle2">{{ systemOverview.cpuModel }}</div>
                      <div class="text-caption">{{ systemOverview.cpuCores }} cores / {{ systemOverview.cpuThreads }} threads</div>
                      <div class="text-caption">Temp: {{ systemTemperature }}°C</div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>

            <!-- Memory Usage -->
            <div class="col-12 col-sm-6 col-md-3">
              <q-card class="dashboard-stat-card">
                <q-card-section>
                  <div class="row items-center no-wrap">
                    <div class="col-auto">
                      <q-knob
                          v-model="memoryUsage"
                          :readonly="true"
                          size="85px"
                          :thickness="0.2"
                          :color="memoryUsage > 80 ? 'negative' : memoryUsage > 60 ? 'warning' : 'positive'"
                          track-color="grey-3"
                          :min="0"
                          :max="100"
                          show-value
                      >
                        {{ memoryUsage }}%
                      </q-knob>
                    </div>
                    <div class="col q-ml-md">
                      <div class="text-h6">Memory Usage</div>
                      <div class="text-subtitle2">{{ memoryTotal }}</div>
                      <div class="text-caption">{{ memoryUsed }} used</div>
                      <div class="text-caption">{{ memoryAvailable }} free</div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>

            <!-- Plugins -->
            <div class="col-12 col-sm-6 col-md-3">
              <q-card class="dashboard-stat-card">
                <q-card-section>
                  <div class="row items-center no-wrap">
                    <div class="col-auto">
                      <q-icon name="extension" size="85px" color="primary" />
                    </div>
                    <div class="col q-ml-md">
                      <div class="text-h6">Plugins</div>
                      <div class="text-subtitle2">{{ totalRunningPlugins }} running</div>
                      <div class="text-caption">{{ totalEnabledPlugins }} enabled</div>
                      <div class="text-caption">{{ totalPlugins }} total</div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <q-card-section>
            <div class="row q-col-gutter-md">
              <!-- CPU Load Average -->
              <div class="col-12 col-md-4" v-if="systemStore.systemInfo.system.load_average">
                <q-card class="sysh_height" flat bordered>
                  <q-card-section>
                    <div class="text-h6 q-mb-md">CPU Load Average</div>
                    <div class="row q-col-gutter-sm">
                      <div class="col-4">
                        <div class="text-center">
                          <div class="text-h6">{{ systemStore.safeNumber(systemStore.systemInfo.system.load_average[0], 0).toFixed(2) }}</div>
                          <div class="text-caption">1 min</div>
                        </div>
                      </div>
                      <div class="col-4">
                        <div class="text-center">
                          <div class="text-h6">{{ systemStore.safeNumber(systemStore.systemInfo.system.load_average[1], 0).toFixed(2) }}</div>
                          <div class="text-caption">5 min</div>
                        </div>
                      </div>
                      <div class="col-4">
                        <div class="text-center">
                          <div class="text-h6">{{ systemStore.safeNumber(systemStore.systemInfo.system.load_average[2], 0).toFixed(2) }}</div>
                          <div class="text-caption">15 min</div>
                        </div>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>

              <!-- SWAP Usage -->
              <div class="col-12 col-md-4" v-if="systemStore.systemInfo.memory?.used_swap">
                <q-card class="sysh_height" flat bordered>
                  <q-card-section>
                    <div class="text-h6 q-mb-md">SWAP Usage</div>
                    <q-linear-progress
                        :value="systemStore.calculatePercentage(systemStore.systemInfo.memory.used_swap, systemStore.systemInfo.memory.total_swap) / 100"
                        size="25px"
                        color="teal"
                    >
                      <div class="absolute-full flex flex-center">
                        <q-badge color="white" text-color="black" :label="systemStore.formatPercentage(systemStore.calculatePercentage(systemStore.systemInfo.memory.used_swap, systemStore.systemInfo.memory.total_swap))" />
                      </div>
                    </q-linear-progress>
                    <div class="row justify-between q-mt-sm">
                      <div class="text-caption">Total: {{ systemStore.formatBytes(systemStore.systemInfo.memory.total_swap) || 0 }}</div>
                      <div class="text-caption">Used: {{ systemStore.formatBytes(systemStore.systemInfo.memory.used_swap) || 0 }}</div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>

              <!-- System Status -->
              <div class="col-12 col-md-4">
                <q-card class="sysh_height" flat bordered>
                  <q-card-section>
                    <div class="text-h6 q-mb-md">System Status</div>
                    <div class="row items-center justify-between">
                      <div>Overall Health:</div>
                      <q-badge :color="
                        cpuUsage > 90 || memoryUsage > 90 ? 'negative' :
                        cpuUsage > 75 || memoryUsage > 75 ? 'warning' :
                        'positive'
                      ">
                        {{
                          cpuUsage > 90 || memoryUsage > 90 ? 'Critical' :
                              cpuUsage > 75 || memoryUsage > 75 ? 'Warning' :
                                  'Good'
                        }}
                      </q-badge>
                    </div>
                    <q-list dense>
                      <q-item>
                        <q-item-section>
                          <q-item-label>Last Boot</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                          <q-item-label>{{ systemStore.formatUptime(systemStore.systemInfo.system.uptime) }} ago</q-item-label>
                        </q-item-section>
                      </q-item>
                      <q-item v-if="systemStore.systemInfo.system.last_update">
                        <q-item-section>
                          <q-item-label>Last Update</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                          <q-item-label>{{ new Date(systemStore.systemInfo.system.last_update).toLocaleString() }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </q-card-section>
                </q-card>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- System Info and Mounted Drives -->
    <div class="row q-col-gutter-md">
      <!-- System Information -->
      <div class="col-12 col-lg-3">
        <div class="row items-first-baseline justify-center">
          <div class="col-6 col-lg-12">
            <q-card>
              <q-card-section class="bg-primary text-white">
                <div class="text-h6">
                  <q-icon name="computer" /> System Overview
                </div>
              </q-card-section>

              <q-card-section>
                <q-list>
                  <q-item>
                    <q-item-section avatar>
                      <q-icon name="devices" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label caption>Hostname</q-item-label>
                      <q-item-label>{{ systemStore.systemInfo?.system?.hostname || 'Loading...' }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section avatar>
                      <q-icon name="terminal" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label caption>Operating System</q-item-label>
                      <q-item-label>{{ systemStore.systemInfo?.system?.name || 'Loading...' }} {{ systemStore.systemInfo?.system?.os_version || '' }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section avatar>
                      <q-icon name="memory" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label caption>Architecture</q-item-label>
                      <q-item-label>{{ systemStore.systemInfo?.system?.arch || 'Loading...' }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section avatar>
                      <q-icon name="timer" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label caption>Uptime</q-item-label>
                      <q-item-label>{{ systemStore.formatUptime(systemStore.safeNumber(systemStore.systemInfo?.system?.uptime)) }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item v-if="systemStore.systemInfo?.system?.kernel">
                    <q-item-section avatar>
                      <q-icon name="settings" color="primary" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label caption>Kernel Version</q-item-label>
                      <q-item-label>{{ systemStore.systemInfo.system.kernel }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </div>

          <div class="col-6 col-lg-12">
            <!-- Network information -->
            <q-card class="responsive-card-home">
              <q-card-section class="bg-primary text-white">
                <div class="text-h6">
                  <q-icon name="wifi" /> Network
                </div>
              </q-card-section>

              <q-card-section>
                <q-list>
                  <template v-for="(iface, index) in systemStore.systemInfo?.networks || []" :key="index">
                    <q-expansion-item
                        :label="iface.name"
                        :caption="iface.ip_addresses && iface.ip_addresses.length > 0 ?
                `${iface.ip_addresses[0].address}/${iface.ip_addresses[0].net_mask}` : 'No IP'"
                        :header-class="index > 0 ? 'q-mt-sm' : ''"
                        expand-separator
                        icon="lan"
                    >
                      <q-card>
                        <q-card-section>
                          <div class="row q-col-gutter-sm">
                            <div class="col-12">
                              <q-item dense>
                                <q-item-section>
                                  <q-item-label caption>IP Addresses & Gateways</q-item-label>
                                  <q-item-label>
                                    <template v-if="iface.ip_addresses && iface.ip_addresses.length > 0">
                                      <div v-for="(ip, idx) in iface.ip_addresses" :key="idx" class="q-mb-sm">
                                        <!-- IP Address -->
                                        <div class="row items-center">
                                          <div class="col-12">
                                            <span class="text-weight-medium">IP: </span>
                                            {{ ip.address }}/{{ ip.net_mask }}
                                          </div>
                                        </div>
                                        <!-- Gateway -->
                                        <div class="row items-center q-mb-md">
                                          <div class="col-12">
                                            <span class="text-weight-medium">Gateway: </span>
                                            {{ ip.gateway || 'Not set' }}
                                          </div>
                                        </div>
                                      </div>
                                    </template>
                                    <div v-else>
                                      No IP addresses
                                    </div>
                                  </q-item-label>
                                </q-item-section>
                              </q-item>
                            </div>

                            <!-- Network stats -->
                            <div class="col-12">
                              <q-item dense>
                                <q-item-section>
                                  <q-item-label caption>Data Transferred</q-item-label>
                                  <q-item-label>
                                    <div class="row">
                                      <div class="col">↓ {{ systemStore.formatBytes(systemStore.safeNumber(iface.data_downloaded)) || 0 }}</div>
                                      <div class="col">↑ {{ systemStore.formatBytes(systemStore.safeNumber(iface.data_uploaded)) || 0 }}</div>
                                    </div>
                                  </q-item-label>
                                </q-item-section>
                              </q-item>
                            </div>
                          </div>
                        </q-card-section>
                      </q-card>
                    </q-expansion-item>
                  </template>

                  <q-item v-if="!systemStore.systemInfo?.networks || systemStore.systemInfo.networks.length === 0">
                    <q-item-section>
                      <q-item-label>No network interfaces found</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>

      <!-- Mounted Drives & GPU -->
      <div class="col-12 col-lg-9">
        <q-card>
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">
              <q-icon name="storage" /> Mounted Drives
            </div>
          </q-card-section>

          <q-table class="drive_min"
                   :rows="driveStatuses"
                   :columns="[
              { name: 'device', label: 'Device', field: 'device', sortable: true },
              { name: 'mountPoint', label: 'Mount Point', field: 'mountPoint', sortable: true },
              { name: 'type', label: 'Type', field: 'type', sortable: true },
              { name: 'size', label: 'Size', field: 'size', sortable: true,
                format: val => formatBytes(val || 0) },
              { name: 'usage', label: 'Usage', field: 'usage', sortable: true,
                format: val => `${val}` }
            ]"
                   row-key="device"
                   :pagination="{ rowsPerPage: 5 }"
                   flat
                   bordered
          >
            <template v-slot:body-cell-usage="props">
              <q-td :props="props">
                <q-linear-progress
                    :value="props.value / 100"
                    size="25px"
                    :color="
                    props.value > 90 ? 'negative' :
                    props.value > 75 ? 'warning' :
                    'positive'
                  "
                >
                  <div class="absolute-full flex flex-center">
                    <q-badge color="white" text-color="black" :label="`${props.value}%`" />
                  </div>
                </q-linear-progress>
              </q-td>
            </template>
          </q-table>
        </q-card>

        <!-- GPU Section -->
        <div>
          <q-card class="q-mt-md">
            <q-card-section class="bg-primary text-white">
              <div class="text-h6">
                <q-icon name="videogame_asset" /> GPUs ({{ systemStore.systemInfo?.gpus.length }})
              </div>
            </q-card-section>

            <q-card-section>
              <div v-if="!systemStore.systemInfo?.gpus || systemStore.systemInfo.gpus.length === 0" class="text-center q-py-lg text-grey-6">
                No GPU information available
              </div>

              <div v-else>
                <!-- GPU Summary -->
                <q-table
                  :rows="systemStore.systemInfo.gpus"
                  :columns="[
          { name: 'index', label: '#', field: 'index', align: 'center' },
          { name: 'name', label: 'GPU', field: gpu => `${gpu.brand || ''} ${gpu.name || 'Unknown'}`, align: 'left' },
          { name: 'temperature', label: 'Temperature', field: 'temperature', align: 'center',
            format: val => `${systemStore.safeNumber(val)}°C` },
          { name: 'gpu_usage', label: 'GPU Usage', field: 'gpu_usage', align: 'center',
            format: val => systemStore.formatPercentage(val) },
          { name: 'memory_usage', label: 'Memory Usage', field: 'memory_usage', align: 'center',
            format: val => systemStore.formatPercentage(val) },
          { name: 'fan_speed', label: 'Fan Speed', field: gpu => gpu.fan_speeds && gpu.fan_speeds.length > 0 ? gpu.fan_speeds[0] : 'N/A', align: 'center',
            format: val => typeof val === 'number' ? `${val}%` : val }
        ]"
                  row-key="index"
                  dense
                  hide-pagination
                  :pagination="{rowsPerPage: 0}"
              >
                <template v-slot:body="props">
                  <q-tr :props="props">
                    <q-td v-for="col in props.cols" :key="col.name" :props="props">
                      {{ col.value }}

                      <!-- Progress bars for temperature, usage, etc -->
                      <template v-if="col.name === 'temperature'">
                        <q-linear-progress
                            :value="getTemperaturePercentage(props.row.temperature)"
                            size="5px"
                            :color="getTemperatureColor(props.row.temperature)"
                            class="q-mt-xs"
                        />
                      </template>

                      <template v-if="col.name === 'gpu_usage'">
                        <q-linear-progress
                            :value="props.row.gpu_usage / 100"
                            size="5px"
                            :color="getGpuColor(props.row.gpu_usage)"
                            class="q-mt-xs"
                        />
                      </template>

                      <template v-if="col.name === 'memory_usage'">
                        <q-linear-progress
                            :value="props.row.memory_usage / 100"
                            size="5px"
                            :color="getGpuColor(props.row.memory_usage)"
                            class="q-mt-xs"
                        />
                      </template>

                      <template v-if="col.name === 'fan_speed' && typeof props.row.fan_speeds?.[0] === 'number'">
                        <q-linear-progress
                            :value="props.row.fan_speeds[0] / 100"
                            size="5px"
                            :color="props.row.fan_speeds[0] > 80 ? 'negative' : props.row.fan_speeds[0] > 60 ? 'warning' : 'positive'"
                            class="q-mt-xs"
                        />
                      </template>
                    </q-td>
                  </q-tr>
                </template>
              </q-table>

              <!-- Detailed GPU information -->
              <div class="q-mt-md">
                <q-expansion-item
                    v-for="(gpu, index) in systemStore.systemInfo.gpus"
                    :key="index"
                    :label="`${gpu.brand || ''} ${gpu.name || 'Unknown GPU'}`"
                    header-class="text-primary"
                    expand-separator
                >
                  <q-card>
                    <q-card-section>
                      <div class="row q-col-gutter-md">
                        <!-- GPU Properties -->
                        <div class="col-12">
                          <div class="row q-col-gutter-md">
                            <!-- Temperature -->
                            <div class="col-12 col-sm-4">
                              <q-card flat bordered>
                                <q-card-section>
                                  <div class="text-h6 q-mb-md">Temperature</div>
                                  <q-linear-progress
                                      :value="getTemperaturePercentage(gpu.temperature)"
                                      size="25px"
                                      :color="getTemperatureColor(gpu.temperature)"
                                  >
                                    <div class="absolute-full flex flex-center">
                                      <q-badge color="white" text-color="black" :label="`${gpu.temperature}°C`" />
                                    </div>
                                  </q-linear-progress>
                                </q-card-section>
                              </q-card>
                            </div>

                            <!-- GPU Usage -->
                            <div class="col-12 col-sm-4">
                              <q-card flat bordered>
                                <q-card-section>
                                  <div class="text-h6 q-mb-md">GPU Usage</div>
                                  <q-linear-progress
                                      :value="gpu.gpu_usage / 100"
                                      size="25px"
                                      :color="getGpuColor(gpu.gpu_usage)"
                                  >
                                    <div class="absolute-full flex flex-center">
                                      <q-badge color="white" text-color="black" :label="systemStore.formatPercentage(gpu.gpu_usage)" />
                                    </div>
                                  </q-linear-progress>
                                </q-card-section>
                              </q-card>
                            </div>

                            <!-- Memory Usage -->
                            <div class="col-12 col-sm-4">
                              <q-card flat bordered>
                                <q-card-section>
                                  <div class="text-h6 q-mb-md">Memory Usage</div>
                                  <q-linear-progress
                                      :value="gpu.memory_usage / 100"
                                      size="25px"
                                      :color="getGpuColor(gpu.memory_usage)"
                                  >
                                    <div class="absolute-full flex flex-center">
                                      <q-badge color="white" text-color="black" :label="systemStore.formatPercentage(gpu.memory_usage)" />
                                    </div>
                                  </q-linear-progress>
                                </q-card-section>
                              </q-card>
                            </div>

                            <!-- Fan Speed -->
                            <div class="col-12 q-mt-md" v-if="gpu.fan_speeds && gpu.fan_speeds.length > 0">
                              <q-card flat bordered>
                                <q-card-section>
                                  <div class="text-h6 q-mb-md">Fan Speeds</div>
                                  <div class="row q-col-gutter-md">
                                    <div class="col-12 col-sm-4" v-for="(speed, i) in gpu.fan_speeds" :key="i">
                                      <div class="text-subtitle2 q-mb-xs">Fan #{{ i + 1 }}</div>
                                      <q-linear-progress
                                          :value="speed / 100"
                                          size="25px"
                                          :color="speed > 80 ? 'negative' : speed > 60 ? 'warning' : 'positive'"
                                      >
                                        <div class="absolute-full flex flex-center">
                                          <q-badge color="white" text-color="black" :label="`${speed}%`" />
                                        </div>
                                      </q-linear-progress>
                                    </div>
                                  </div>
                                </q-card-section>
                              </q-card>
                            </div>
                          </div>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </q-expansion-item>
              </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <Notification />
  </q-page>
</template>

<style scoped>
.dashboard-stat-card {
  transition: all 0.3s ease;
}

.dashboard-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.quick-action-card {
  transition: all 0.2s ease;
}

.quick-action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  background-color: #f5f5f5;
}

:deep(.q-table th) {
  font-weight: 600;
  background-color: #f5f5f5;
}

:deep(.q-knob) {
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
}

.key-stats {
  justify-content: center;
}

.drive_min {
  min-height: 288px;
}

.sysh_height {
  min-height: 165px;
}

@media screen and (max-width: 1439px) {
  .row>.col-lg-9 {
    height: auto;
    width: 100%;
  }
}
</style>