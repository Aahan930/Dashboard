<script setup>
import ProjectSelector from './ProjectSelector.vue'

defineProps({
  entry: {
    type: Object,
    required: true
  },

  index: {
    type: Number,
    required: true
  },

  entriesCount: {
    type: Number,
    required: true
  },

  activityTypes: {
    type: Array,
    default: () => []
  },

  activityLoading: {
    type: Boolean,
    default: false
  },

  managerView: {
    type: Boolean,
    default: false
  },

  activityError: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'update',
  'remove',
  'create-activity'
])

function update(field, value) {
  emit('update', field, value)
}

function remove() {
  emit('remove')
}

function createActivity() {
  emit('create-activity')
}
</script>

<template>
  <div class="entry-card">
    <div class="entry-grid">

      <!-- Project -->
      <div class="form-field">
        <label>Project</label>

        <ProjectSelector
          :model-value="entry.project"
          @update:model-value="
            update('project', $event)
          "
        />
      </div>

      <!-- Deliverables -->
      <div class="form-field">
        <label>Deliverables</label>

        <input
          :value="entry.deliverables"
          type="text"
          maxlength="255"
          placeholder="Enter deliverable"
          @input="
            update(
              'deliverables',
              $event.target.value
            )
          "
        />
      </div>

      <!-- Activity Type -->
      <div class="form-field">
        <label>Activity Type</label>

        <select
          :value="entry.activity_type"
          :disabled="activityLoading"
          @change="
            update(
              'activity_type',
              $event.target.value
            )
          "
        >
          <option value="">
            {{
              activityLoading
                ? 'Loading Activity Types...'
                : 'Select Activity Type'
            }}
          </option>

          <option
            v-for="activity in activityTypes"
            :key="activity.name"
            :value="activity.name"
          >
            {{ activity.name }}
          </option>
        </select>

        <button
          v-if="index === 0"
          type="button"
          class="create-activity-btn"
          @click="createActivity"
        >
          + Create Activity Type
        </button>

        <span
          v-if="activityError && index === 0"
          class="activity-error"
        >
          {{ activityError }}
        </span>
      </div>

      <!-- Description -->
      <div class="form-field">
        <label>Description</label>

        <input
          :value="entry.description"
          type="text"
          placeholder="Describe the work performed"
          @input="
            update(
              'description',
              $event.target.value
            )
          "
        />
      </div>

      <!-- Hours -->
      <div class="form-field hours-field">
        <label>Hours</label>

        <input
          :value="entry.hours || ''"
          type="number"
          min="0"
          step="0.25"
          placeholder="0"
          @input="
            update(
              'hours',
              Number($event.target.value) || 0
            )
          "
        />
      </div>

      <!-- Remove -->
      <div
        v-if="entriesCount > 1"
        class="remove-field"
      >
        <button
          type="button"
          class="remove-entry-btn"
          aria-label="Remove work entry"
          @click="remove"
        >
          ×
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.entry-card {
  width: 100%;
  background: #fff;
}

.entry-grid {
  display: grid;
  grid-template-columns:
    minmax(180px, 1.15fr)
    minmax(190px, 1.25fr)
    minmax(175px, 1.1fr)
    minmax(230px, 1.5fr)
    95px
    42px;

  align-items: stretch;
}

.form-field {
  min-width: 0;
  padding: 12px;
  border-right: 1px solid #e6eaf0;
}

.form-field label {
  display: block;
  min-height: 14px;
  margin-bottom: 7px;

  color: #768293;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: .35px;
  text-transform: uppercase;
}

.form-field input,
.form-field select {
  width: 100%;
  height: 38px;
  min-width: 0;

  padding: 7px 9px;

  border: 1px solid #d5dce4;
  border-radius: 5px;

  background: #fff;
  color: #303846;

  font: inherit;
  font-size: 12px;
}

.form-field input::placeholder {
  color: #a1aab5;
}

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: #7899b8;
  box-shadow: 0 0 0 2px rgba(63, 111, 159, .08);
}

.hours-field input {
  text-align: right;
}

.create-activity-btn {
  display: block;
  margin-top: 5px;
  padding: 0;

  border: 0;
  background: transparent;

  color: #3f6f9f;
  font-size: 10px;
  font-weight: 600;

  cursor: pointer;
}

.create-activity-btn:hover {
  text-decoration: underline;
}

.activity-error {
  display: block;
  margin-top: 4px;
  color: #b54747;
  font-size: 10px;
}

.remove-field {
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-entry-btn {
  width: 26px;
  height: 26px;
  padding: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border: 1px solid #dce2e8;
  border-radius: 5px;

  background: #fff;
  color: #8994a1;

  font-family: Arial, sans-serif;
  font-size: 18px;
  line-height: 1;

  cursor: pointer;
}

.remove-entry-btn:hover {
  border-color: #dfb8b8;
  background: #fff7f7;
  color: #b54747;
}

@media (max-width: 1100px) {
  .entry-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .remove-field {
    justify-content: flex-end;
    padding: 12px;
  }
}

@media (max-width: 700px) {
  .entry-grid {
    grid-template-columns: 1fr;
  }

  .form-field {
    border-right: 0;
    border-bottom: 1px solid #e6eaf0;
  }

  .remove-field {
    justify-content: flex-end;
  }
}
</style>
