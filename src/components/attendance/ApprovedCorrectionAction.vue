<script setup>
import { ref } from 'vue'
import api, { errMsg } from '../../api'

const props = defineProps({
  request: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['marked'])

const busy = ref(false)
const error = ref('')

const canMark =
  props.request.workflow_state === 'Approved' &&
  props.request.request_type === 'Correct' &&
  props.request.requested_status === 'Present' &&
  props.request.attendance_status === 'Absent' &&
  Number(props.request.attendance_docstatus) === 1

async function markPresent() {
  if (!canMark || busy.value) return

  busy.value = true
  error.value = ''

  try {
    const response = await api.post(
      '/api/method/hr_portal_custom.api.attendance_correction.mark_approved_correction',
      {
        request_id: props.request.name
      }
    )

    const result = response.data.message

    if (!result?.success) {
      throw new Error(
        'Attendance was not confirmed by the server.'
      )
    }

    emit('marked')
  } catch (e) {
    error.value = errMsg(
      e,
      'Could not mark this attendance Present.'
    )
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="canMark" class="approved-correction-action">
    <button
      type="button"
      class="mark-present-button"
      :disabled="busy"
      @click="markPresent"
    >
      {{ busy ? 'Marking...' : '✓ Mark Present' }}
    </button>

    <small v-if="error" class="mark-present-error">
      {{ error }}
    </small>
  </div>

  <span
    v-else-if="
      request.workflow_state === 'Approved' &&
      request.request_type === 'Correct' &&
      request.requested_status === 'Present'
    "
    class="marked-label"
  >
    {{ request.attendance_status === 'Present'
      ? 'Marked Present'
      : 'Awaiting action' }}
  </span>
</template>

<style scoped>
.approved-correction-action {
  display: grid;
  gap: 5px;
  min-width: 125px;
}

.mark-present-button {
  border: 0;
  border-radius: 8px;
  padding: 8px 11px;
  background: #1f7a4d;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.mark-present-button:disabled {
  opacity: .65;
  cursor: wait;
}

.mark-present-error {
  color: #c0392b;
  line-height: 1.35;
}

.marked-label {
  color: #1f7a4d;
  font-size: 12px;
  font-weight: 700;
}
</style>
