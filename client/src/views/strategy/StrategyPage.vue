<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import strategyApi from '@/api/strategy'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentId = ref('')
const strategies = ref([])

const form = reactive({
  name: '',
  type: 'manual',
  description: '',
  stopLoss: 8,
  takeProfit: 15,
  position: 100,
  entryText: '["收盘价上穿MA20"]',
  exitText: '["收盘价下穿MA20"]'
})

const rules = {
  name: [{ required: true, message: '请输入策略名称', trigger: 'blur' }]
}

const formRef = ref()

function formatDate(v) {
  if (!v) return '--'
  return new Date(v).toLocaleString('zh-CN', { hour12: false })
}

function parseConditions(text, fieldName) {
  try {
    const parsed = JSON.parse(text || '[]')
    if (!Array.isArray(parsed)) throw new Error()
    return parsed
  } catch {
    throw new Error(`${fieldName}必须是 JSON 数组`)
  }
}

function resetForm() {
  form.name = ''
  form.type = 'manual'
  form.description = ''
  form.stopLoss = 8
  form.takeProfit = 15
  form.position = 100
  form.entryText = '["收盘价上穿MA20"]'
  form.exitText = '["收盘价下穿MA20"]'
  currentId.value = ''
  isEdit.value = false
}

async function loadStrategies() {
  loading.value = true
  try {
    const res = await strategyApi.list()
    strategies.value = res.data || []
  } catch (err) {
    ElMessage.error(err.message || '加载策略失败')
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  currentId.value = row._id
  form.name = row.name || ''
  form.type = row.type || 'manual'
  form.description = row.description || ''
  form.stopLoss = Number(row.params?.stopLoss ?? 8)
  form.takeProfit = Number(row.params?.takeProfit ?? 15)
  form.position = Number(row.params?.position ?? 100)
  form.entryText = JSON.stringify(row.conditions?.entry || [], null, 2)
  form.exitText = JSON.stringify(row.conditions?.exit || [], null, 2)
  dialogVisible.value = true
}

async function saveStrategy() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    let entry = []
    let exit = []
    try {
      entry = parseConditions(form.entryText, '入场条件')
      exit = parseConditions(form.exitText, '出场条件')
    } catch (err) {
      ElMessage.error(err.message)
      return
    }
    const payload = {
      name: form.name,
      type: form.type,
      description: form.description,
      conditions: { entry, exit },
      params: {
        stopLoss: Number(form.stopLoss),
        takeProfit: Number(form.takeProfit),
        position: Number(form.position)
      }
    }
    saving.value = true
    try {
      if (isEdit.value) {
        await strategyApi.update(currentId.value, payload)
        ElMessage.success('策略已更新')
      } else {
        await strategyApi.create(payload)
        ElMessage.success('策略已创建')
      }
      dialogVisible.value = false
      await loadStrategies()
    } catch (err) {
      ElMessage.error(err.message || '保存策略失败')
    } finally {
      saving.value = false
    }
  })
}

async function removeStrategy(row) {
  try {
    await ElMessageBox.confirm(`确认删除策略「${row.name}」吗？`, '提示', { type: 'warning' })
    await strategyApi.remove(row._id)
    ElMessage.success('策略已删除')
    await loadStrategies()
  } catch {}
}

onMounted(loadStrategies)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="sq-list-title">策略管理</h2>
      <el-button type="primary" @click="openCreateDialog">新建策略</el-button>
    </div>

    <el-card class="sq-list-card">
      <el-table :data="strategies" v-loading="loading" stripe class="sq-list-table">
        <el-table-column prop="name" label="策略名称" min-width="160" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'ai-generated' ? 'success' : 'info'">
              {{ row.type === 'ai-generated' ? 'AI生成' : '手动' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="风控参数" min-width="220">
          <template #default="{ row }">
            止损 {{ row.params?.stopLoss ?? '--' }}% / 止盈 {{ row.params?.takeProfit ?? '--' }}% / 仓位 {{ row.params?.position ?? '--' }}%
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="removeStrategy(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑策略' : '新建策略'" width="760px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
        <el-form-item label="策略名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：MA20突破策略" />
        </el-form-item>
        <el-form-item label="策略类型">
          <el-select v-model="form.type" style="width: 200px">
            <el-option value="manual" label="手动" />
            <el-option value="ai-generated" label="AI生成" />
          </el-select>
        </el-form-item>
        <el-form-item label="策略说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="止损(%)">
              <el-input-number v-model="form.stopLoss" :min="0" :max="100" :step="0.5" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="止盈(%)">
              <el-input-number v-model="form.takeProfit" :min="0" :max="200" :step="0.5" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="仓位(%)">
              <el-input-number v-model="form.position" :min="1" :max="100" :step="1" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="入场条件">
          <el-input v-model="form.entryText" type="textarea" :rows="4" placeholder='JSON 数组，例如 ["收盘价上穿MA20"]' />
        </el-form-item>
        <el-form-item label="出场条件">
          <el-input v-model="form.exitText" type="textarea" :rows="4" placeholder='JSON 数组，例如 ["收盘价下穿MA20"]' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveStrategy">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
