<script setup lang="ts">
import { useNotificationStore } from '@/stores/notificationStore';

const notificationStore = useNotificationStore();

function dismissNotification(id: string): void {
  notificationStore.dismiss(id);
}

function getProgressColor(type: string): string {
  switch (type) {
    case 'positive':
      return 'var(--q-positive)';
    case 'negative':
      return 'var(--q-negative)';
    case 'warning':
      return 'var(--q-warning)';
    case 'info':
      return 'var(--q-info)';
    default:
      return 'var(--q-primary)';
  }
}
</script>

<template>
  <div class="notification-container">
    <transition-group
        name="notification-fade"
        tag="div"
        class="notifications"
    >
      <div
          v-for="notification in notificationStore.activeNotifications"
          :key="notification.id"
          :class="[
          'notification',
          `notification--${notification.type}`,
          { 'notification--visible': notification.visible }
        ]"
      >
        <div class="notification__icon" v-if="notification.icon">
          <q-icon :name="notification.icon" size="24px" />
        </div>
        <div class="notification__content">
          <div class="notification__message">{{ notification.message }}</div>
          <div class="notification__caption" v-if="notification.caption">
            {{ notification.caption }}
          </div>
          <div class="notification__details" v-if="notification.details">
            {{ notification.details }}
          </div>

          <div class="notification__actions" v-if="notification.actions && notification.actions.length > 0">
            <q-btn
                v-for="(action, index) in notification.actions"
                :key="index"
                :color="action.color || 'white'"
                flat
                dense
                :label="action.label"
                @click="action.handler"
            />
          </div>
        </div>
        <div
            class="notification__close"
            v-if="notification.closable"
            @click="dismissNotification(notification.id)"
        >
          <q-icon name="close" size="16px" />
        </div>

        <div
            v-if="notification.timeout && notification.timeout > 0"
            class="notification__progress"
        >
          <div
              class="notification__progress-bar"
              :style="{
              animationDuration: `${notification.timeout}ms`,
              backgroundColor: getProgressColor(notification.type)
            }"
          ></div>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.notification-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
  pointer-events: none;
}

.notifications {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification {
  display: flex;
  position: relative;
  min-width: 260px;
  max-width: 100%;
  background-color: #333;
  color: white;
  border-radius: 6px;
  padding: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transform: translateX(50px);
  pointer-events: auto;
  overflow: hidden;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.notification--visible {
  opacity: 1;
  transform: translateX(0);
}

.notification--positive {
  background-color: var(--q-positive);
}

.notification--negative {
  background-color: var(--q-negative);
}

.notification--warning {
  background-color: var(--q-warning);
}

.notification--info {
  background-color: var(--q-info);
}

.notification__icon {
  margin-right: 12px;
  display: flex;
  align-items: flex-start;
}

.notification__content {
  flex: 1;
}

.notification__message {
  font-weight: 500;
  margin-bottom: 4px;
}

.notification__caption {
  font-size: 0.9em;
  opacity: 0.9;
}

.notification__details {
  font-size: 0.85em;
  opacity: 0.8;
  margin-top: 6px;
}

.notification__close {
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
  margin: -4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.notification__close:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.notification__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.notification__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.1);
}

.notification__progress-bar {
  height: 100%;
  width: 100%;
  transform-origin: left center;
  animation-name: notification-progress;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes notification-progress {
  0% {
    transform: scaleX(1);
  }
  100% {
    transform: scaleX(0);
  }
}

/* Transition styles */
.notification-fade-enter-active {
  transition: all 0.3s ease;
}

.notification-fade-leave-active {
  transition: all 0.3s ease;
  position: absolute;
}

.notification-fade-enter-from {
  opacity: 0;
  transform: translateX(50px);
}

.notification-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>