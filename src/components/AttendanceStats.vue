<script setup>
const emit = defineEmits(['select'])

defineProps({
  percentage: {
    type: Number,
    default: 0
  },
  recordedDays: {
    type: Number,
    default: 0
  },
  present: {
    type: Number,
    default: 0
  },
  absent: {
    type: Number,
    default: 0
  },
  leave: {
    type: Number,
    default: 0
  }
})
</script>

<template>
  <section class="stats-grid">

    <div class="stat-card">
      <div class="stat-icon purple">%</div>

      <div class="stat-content">
        <span class="stat-label">Attendance rate</span>

        <strong class="stat-number">
          {{ percentage }}%
        </strong>

        <span class="stat-subtext">
          Based on {{ recordedDays }} recorded day(s)
        </span>
      </div>
    </div>

    <button
      type="button"
      class="stat-card clickable-stat"
      aria-label="View present days details"
      @click="emit('select', 'Present')"
    >
      <div class="stat-icon green">✓</div>

      <div class="stat-content">
        <span class="stat-label">Present Days</span>

        <strong class="stat-number">
          {{ present }}
        </strong>

        <span class="stat-subtext">
          Days present
        </span>
      </div>
    </button>

    <button
      type="button"
      class="stat-card clickable-stat"
      aria-label="View absent days details"
      @click="emit('select', 'Absent')"
    >
      <div class="stat-icon red">×</div>

      <div class="stat-content">
        <span class="stat-label">Absent Days</span>

        <strong class="stat-number">
          {{ absent }}
        </strong>

        <span class="stat-subtext">
          Days absent
        </span>
      </div>
    </button>

    <button
      type="button"
      class="stat-card clickable-stat"
      aria-label="View on leave details"
      @click="emit('select', 'On Leave')"
    >
      <div class="stat-icon blue">✈</div>

      <div class="stat-content">
        <span class="stat-label">On Leave</span>

        <strong class="stat-number">
          {{ leave }}
        </strong>

        <span class="stat-subtext">
          Leave days
        </span>
      </div>
    </button>

  </section>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 22px;
}

.stat-card {
  background: white;
  border: 1px solid #eef0f6;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 15px;
  min-height: 115px;
  box-sizing: border-box;
}

.clickable-stat {
  width: 100%;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color .2s, box-shadow .2s, transform .2s;
}

.clickable-stat:hover {
  border-color: #c4b5fd;
  box-shadow: 0 5px 18px rgba(91, 33, 243, .09);
  transform: translateY(-2px);
}

.clickable-stat:focus-visible {
  outline: 2px solid #5b21f3;
  outline-offset: 3px;
}

.stat-icon {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
}

.stat-icon.purple {
  background: #eee8ff;
  color: #6d28d9;
}

.stat-icon.green {
  background: #e4f8ee;
  color: #12a568;
}

.stat-icon.red {
  background: #ffe7e8;
  color: #ef4444;
}

.stat-icon.blue {
  background: #e5efff;
  color: #2878e8;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #667085;
  font-size: 13px;
  margin-bottom: 5px;
}

.stat-number {
  color: #111827;
  font-size: 25px;
  line-height: 1;
}

.stat-subtext {
  color: #98a2b3;
  font-size: 11px;
  margin-top: 7px;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

/* NB_ATTENDANCE_POLISH: enterprise statistics */

.stats-grid {
  gap: 13px;
  margin-bottom: 22px;
}

.stat-card {
  position: relative;
  min-height: 116px;
  padding: 19px 20px;
  gap: 0;
  border: 1px solid #e2e8f3;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(25, 39, 67, .025);
}

.stat-content {
  min-width: 0;
  padding-right: 42px;
}

.stat-label {
  margin-bottom: 14px;
  color: #65748c;
  font-size: 12px;
  font-weight: 650;
}

.stat-number {
  color: #202d46;
  font-size: 27px;
  font-weight: 750;
  letter-spacing: -.7px;
}

.stat-subtext {
  margin-top: 7px;
  color: #8b98ae;
  font-size: 11px;
}

.stat-icon {
  position: absolute;
  top: 16px;
  right: 17px;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  font-size: 17px;
}

.stat-icon.purple {
  background: #eeeaff;
  color: #5546df;
}

.stat-icon.green {
  background: #e6f8ef;
  color: #139c67;
}

.stat-icon.red {
  background: #ffeaee;
  color: #e04458;
}

.stat-icon.blue {
  background: #e7efff;
  color: #366ee8;
}

.clickable-stat {
  transition: border-color .15s, box-shadow .15s;
}

.clickable-stat:hover {
  transform: none;
  border-color: #b8c3f6;
  box-shadow: 0 4px 16px rgba(79, 70, 229, .08);
}

.clickable-stat:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 3px;
}

@media (max-width: 700px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-card {
    padding: 16px;
  }

  .stat-content {
    padding-right: 26px;
  }

  .stat-icon {
    top: 12px;
    right: 12px;
    width: 27px;
    height: 27px;
  }

  .stat-number {
    font-size: 24px;
  }
}

@media (max-width: 430px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

</style>