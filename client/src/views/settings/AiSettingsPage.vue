<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/userStore'
import aiApi from '@/api/ai'

const userStore = useUserStore()
const loading = ref(false)
const saving = ref(false)
const batchTesting = ref(false)
const testingMap = ref({})
const models = ref([])
const selectedParamModel = ref('')
const ownerFilter = ref('all')
const editingRef = ref('')  // 正在编辑的模型ref，空=新增模式

const defaults = reactive({
  chatModel: '',
  analysisModel: '',
  visionModel: ''
})

const modelForm = reactive({
  name: '',
  id: '',
  providerType: 'openai',
  model: '',
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: '',
  enabled: true,
  isVision: false
})

function defaultParams() {
  return {
    maxTokens: 4096,
    temperature: 1,
    topP: 0.95,
    topK: 20,
    minP: 0,
    presencePenalty: 0,
    frequencyPenalty: 0,
    repetitionPenalty: 1,
    enableThinking: false,
    systemPrompt: ''
  }
}

const paramTooltips = {
  systemPrompt: {
    purpose: '设定 AI 的角色、行为准则和上下文背景。',
    valueGuide: '通常是一段自然语言描述，例如“你是一个专业的金融分析师”。',
    tech: 'System Prompt 会作为对话历史的第一条消息发送给模型，权重较高，能持续影响模型的后续回复风格和逻辑。'
  },
  maxTokens: {
    purpose: '限制 AI 单次回复生成的最大 Token 数量。',
    valueGuide: '通常在 2048 到 8192 之间。设置过小会导致回答被截断，设置过大可能增加延迟和成本。',
    tech: 'Token 是大模型处理文本的基本单位，通常 1 个中文汉字约等于 1-2 个 Token，1 个英文单词约等于 1.3 个 Token。'
  },
  enableThinking: {
    purpose: '是否让 AI 在回答前进行显式的推理思考（CoT）。',
    valueGuide: '开启后 AI 会先输出思考过程，再给出结论。适用于复杂逻辑推理任务。',
    tech: 'Chain of Thought (CoT) 是一种提示工程技术，通过让模型生成中间推理步骤，显著提升其在数学、逻辑和常识推理任务上的表现。'
  },
  temperature: {
    purpose: '控制输出结果的随机性和创造性。',
    valueGuide: '0-0.3：结果专注、确定性高（适合代码）；0.7-1.0：通用对话；>1.0：极具创造性但可能胡言乱语。',
    tech: 'Temperature 参数用于调整模型预测下一个 Token 的概率分布。较高的温度会使概率分布更平缓，增加低概率词被选中的机会。'
  },
  topP: {
    purpose: '另一种控制随机性的方法，与 Temperature 类似但机制不同。',
    valueGuide: '通常设为 0.9 或 0.95。较低的值（如 0.1）会使结果更加确定和保守。建议不要同时大幅调整 Temperature 和 Top-P。',
    tech: 'Nucleus Sampling (Top-P) 仅从累积概率达到 P 的最小候选词集合中进行采样。切断了尾部极低概率的词。'
  },
  topK: {
    purpose: '限制模型仅从概率最高的 K 个词中进行采样。',
    valueGuide: '通常设为 20-100。设为 1 时等同于贪婪解码（总是选概率最高的词）。',
    tech: 'Top-K 是一种硬截断策略，无论后续词的概率差异如何，只保留前 K 个高概率词。它能有效防止模型生成完全离谱的低概率词。'
  },
  minP: {
    purpose: '动态移除概率低于“最高概率 Token * P”的候选词。',
    valueGuide: '通常设为 0.05 或 0.1。',
    tech: 'Min-P 是一种相对阈值截断方法。如果最高概率的词是 0.5，P 是 0.1，那么所有概率低于 0.05 的词都会被剔除。这比 Top-P 更灵活。'
  },
  presencePenalty: {
    purpose: '鼓励模型谈论新话题，惩罚已经出现过的 Token。',
    valueGuide: '范围 -2.0 到 2.0。正值会减少模型重复相同话题的倾向。通常设为 0 到 0.6。',
    tech: '只要一个 Token 在之前的文本中出现过（不论次数），就会对其 Logits 施加惩罚。有助于增加生成内容的主题多样性。'
  },
  frequencyPenalty: {
    purpose: '通过惩罚高频词来减少逐字重复。',
    valueGuide: '范围 -2.0 到 2.0。正值会根据 Token 出现的频率进行惩罚。通常设为 0 到 0.6。',
    tech: '与 Presence Penalty 不同，Frequency Penalty 会根据 Token 出现的次数线性累加惩罚力度。出现次数越多，再次被选中的概率降得越低。'
  },
  repetitionPenalty: {
    purpose: '直接对已生成 Token 的概率进行除法惩罚，强力抑制重复。',
    valueGuide: '1.0 表示无惩罚。通常设为 1.0 到 1.2。设置过高可能导致模型说话变得生硬怪异。',
    tech: '它直接除以 Logits（或在 Softmax 前应用）。与加性的 Presence/Frequency Penalty 相比，它的抑制效果通常更显著且敏感。'
  }
}

const paramEditor = reactive(defaultParams())

const builtinModels = [
  { id: 'deepseek-v3', name: 'DeepSeek V3', providerType: 'openai', model: 'deepseek-ai/DeepSeek-V3', baseURL: 'https://api.deepseek.com/v1', enabled: true, isVision: false },
  { id: 'deepseek-r1', name: 'DeepSeek R1', providerType: 'openai', model: 'deepseek-ai/DeepSeek-R1', baseURL: 'https://api.deepseek.com/v1', enabled: true, isVision: false },
  { id: 'qwen-plus', name: 'Qwen3.5-397B-A17B', providerType: 'openai', model: 'Qwen/Qwen3.5-397B-A17B', baseURL: 'https://api.siliconflow.cn/v1', enabled: true, isVision: true },
  { id: 'qwen_vl', name: 'Qwen2.5-VL 72B', providerType: 'openai', model: 'Qwen/Qwen2.5-VL-72B-Instruct', baseURL: 'https://api.siliconflow.cn/v1', enabled: true, isVision: true },
  { id: 'qwen_vl_lite', name: 'Qwen2.5-VL 7B', providerType: 'openai', model: 'Pro/Qwen/Qwen2.5-VL-7B-Instruct', baseURL: 'https://api.siliconflow.cn/v1', enabled: true, isVision: true },
  { id: 'claude', name: 'Claude 3.5', providerType: 'anthropic', model: 'claude-sonnet-4-20250514', baseURL: '', enabled: true, isVision: false }
]

const myUserId = computed(() => userStore.user?._id || '')
const isAdmin = computed(() => userStore.user?.role === 'admin')
const myModels = computed(() => models.value.filter(m => !m.ownerId || m.ownerId === myUserId.value))
const ownerOptions = computed(() => {
  const map = new Map()
  for (const m of models.value) {
    const key = m.ownerId || 'unknown'
    const label = m.ownerName || '未知用户'
    if (!map.has(key)) map.set(key, label)
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }))
})
const filteredModels = computed(() => {
  if (!isAdmin.value || ownerFilter.value === 'all') return models.value
  return models.value.filter(m => (m.ownerId || 'unknown') === ownerFilter.value)
})
const allEnabledModelOptions = computed(() => models.value.filter(m => m.enabled).map(m => ({
  label: `${m.name}${m.ownerName ? `（${m.ownerName}）` : ''}`,
  value: m.modelRef || m.id
})))
const ownModelOptions = computed(() => myModels.value.map(m => ({
  label: m.name,
  value: m.modelRef || m.id
})))

const selectedModelEntity = computed(() => {
  const ref = selectedParamModel.value
  return myModels.value.find(m => (m.modelRef || m.id) === ref)
})

watch(selectedModelEntity, (m) => {
  Object.assign(paramEditor, m?.params || defaultParams())
}, { immediate: true })

function syncEditorToModel() {
  const m = selectedModelEntity.value
  if (!m) return
  m.params = { ...defaultParams(), ...paramEditor }
}

function resetModelForm() {
  modelForm.name = ''
  modelForm.id = ''
  modelForm.providerType = 'openai'
  modelForm.model = ''
  modelForm.baseURL = 'https://api.siliconflow.cn/v1'
  modelForm.apiKey = ''
  modelForm.enabled = true
  modelForm.isVision = false
}

function addModel() {
  if (!modelForm.name || !modelForm.model || !modelForm.apiKey) {
    ElMessage.warning('请填写模型名称、模型ID与API Key')
    return
  }
  const id = modelForm.id || `custom_${Date.now()}`
  models.value.push({
    id,
    modelRef: `${myUserId.value}::${id}`,
    name: modelForm.name,
    providerType: modelForm.providerType,
    model: modelForm.model,
    baseURL: modelForm.baseURL,
    apiKey: modelForm.apiKey,
    enabled: modelForm.enabled,
    isVision: modelForm.isVision,
    hasApiKey: true,
    ownerId: myUserId.value,
    ownerName: userStore.user?.nickname || userStore.user?.username || '当前用户',
    params: defaultParams()
  })
  selectedParamModel.value = `${myUserId.value}::${id}`
  resetModelForm()
}

function removeModel(ref) {
  models.value = models.value.filter(m => (m.modelRef || m.id) !== ref)
  if (defaults.chatModel === ref) defaults.chatModel = ''
  if (defaults.analysisModel === ref) defaults.analysisModel = ''
  if (defaults.visionModel === ref) defaults.visionModel = ''
  if (selectedParamModel.value === ref) selectedParamModel.value = ownModelOptions.value[0]?.value || ''
  if (editingRef.value === ref) { editingRef.value = ''; resetModelForm() }
}

function editModel(m) {
  editingRef.value = m.modelRef || m.id
  modelForm.name = m.name
  modelForm.id = m.id
  modelForm.providerType = m.providerType
  modelForm.model = m.model
  modelForm.baseURL = m.baseURL
  modelForm.apiKey = ''  // 不回填密钥
  modelForm.enabled = m.enabled
  modelForm.isVision = m.isVision
}

function updateModel() {
  const ref = editingRef.value
  const idx = models.value.findIndex(m => (m.modelRef || m.id) === ref)
  if (idx === -1) return
  models.value[idx].name = modelForm.name
  models.value[idx].providerType = modelForm.providerType
  models.value[idx].model = modelForm.model
  models.value[idx].baseURL = modelForm.baseURL
  if (modelForm.apiKey) models.value[idx].apiKey = modelForm.apiKey  // 有填才更新
  models.value[idx].enabled = modelForm.enabled
  models.value[idx].isVision = modelForm.isVision
  editingRef.value = ''
  resetModelForm()
  ElMessage.success('模型已更新（请点保存生效）')
}

function cancelEdit() {
  editingRef.value = ''
  resetModelForm()
}

function isOwnModel(m) {
  return !m.ownerId || m.ownerId === myUserId.value
}

async function testModel(m) {
  const ref = m.modelRef || m.id
  testingMap.value[ref] = true
  try {
    const { data } = await aiApi.testSettings({
      modelRef: ref,
      params: m.params || defaultParams()
    })
    ElMessage.success(`连通成功: ${data.preview || 'OK'}`)
  } catch (err) {
    ElMessage.error(`连通失败: ${err.message || ''}`)
  } finally {
    testingMap.value[ref] = false
  }
}

async function testVisibleModels() {
  const candidates = filteredModels.value.filter(m => m.enabled && m.hasApiKey)
  if (!candidates.length) {
    ElMessage.warning('当前筛选条件下没有可测试模型')
    return
  }
  batchTesting.value = true
  let success = 0
  let failed = 0
  const failedNames = []
  for (const m of candidates) {
    const ref = m.modelRef || m.id
    testingMap.value[ref] = true
    try {
      await aiApi.testSettings({
        modelRef: ref,
        params: m.params || defaultParams()
      })
      success += 1
    } catch {
      failed += 1
      failedNames.push(m.name)
    } finally {
      testingMap.value[ref] = false
    }
  }
  batchTesting.value = false
  if (!failed) {
    ElMessage.success(`批量测试完成：成功 ${success} 个`)
  } else {
    ElMessage.warning(`批量测试完成：成功 ${success} 个，失败 ${failed} 个（${failedNames.slice(0, 3).join('、')}）`)
  }
}

async function testNewModel() {
  if (!modelForm.model || !modelForm.apiKey) {
    ElMessage.warning('请先填写模型ID与API Key')
    return
  }
  testingMap.value.new = true
  try {
    await aiApi.testSettings({
      modelConfig: {
        id: modelForm.id || modelForm.model,
        name: modelForm.name || modelForm.model,
        providerType: modelForm.providerType,
        model: modelForm.model,
        baseURL: modelForm.baseURL,
        apiKey: modelForm.apiKey
      },
      params: defaultParams()
    })
    ElMessage.success('连通测试通过，可添加保存')
  } catch (err) {
    ElMessage.error(`连通测试失败: ${err.message || ''}`)
  } finally {
    testingMap.value.new = false
  }
}

async function loadSettings() {
  loading.value = true
  try {
    await userStore.refreshProfile()
    const { data } = await aiApi.getSettings()
    const fromServer = (data.models || []).map(m => ({ ...m, apiKey: '', params: { ...defaultParams(), ...(m.params || {}) } }))
    const ownIds = new Set(fromServer.filter(m => !m.ownerId || m.ownerId === myUserId.value).map(m => m.id))
    for (const b of builtinModels) {
      if (!ownIds.has(b.id)) {
        fromServer.push({
          ...b,
          modelRef: `${myUserId.value}::${b.id}`,
          ownerId: myUserId.value,
          ownerName: userStore.user?.nickname || userStore.user?.username || '当前用户',
          apiKey: '',
          hasApiKey: false,
          apiKeyPreview: '',
          params: defaultParams()
        })
      }
    }
    models.value = fromServer
    Object.assign(defaults, data.defaults || {})
    selectedParamModel.value = ownModelOptions.value[0]?.value || ''
    ownerFilter.value = 'all'
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    syncEditorToModel()
    const payload = {
      models: myModels.value.map(m => ({
        id: m.id,
        name: m.name,
        providerType: m.providerType,
        model: m.model,
        baseURL: m.baseURL,
        apiKey: m.apiKey || undefined,
        enabled: m.enabled,
        isVision: m.isVision,
        params: { ...defaultParams(), ...(m.params || {}) }
      })),
      defaults: { ...defaults }
    }
    await aiApi.updateSettings(payload)
    ElMessage.success('AI 设置已保存')
    await loadSettings()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div v-loading="loading">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">模型设置</h2>
      <el-button type="primary" :loading="saving" @click="saveSettings">💾 保存所有设置</el-button>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <!-- ========== 左栏: 模型列表 (占3列) ========== -->
      <div class="xl:col-span-3 space-y-4">
        <!-- 模型列表 -->
        <div class="set-card">
          <div class="set-card-header">
            <span>模型列表</span>
            <div class="flex items-center gap-2 ml-auto">
              <el-select v-if="isAdmin" v-model="ownerFilter" size="small" style="width: 150px" placeholder="按创建人筛选">
                <el-option label="全部创建人" value="all" />
                <el-option v-for="o in ownerOptions" :key="`owner-${o.value}`" :label="o.label" :value="o.value" />
              </el-select>
              <el-button size="small" :loading="batchTesting" @click="testVisibleModels">批量测试</el-button>
            </div>
          </div>
          <div class="p-3 space-y-2 max-h-[520px] overflow-y-auto">
            <div v-for="m in filteredModels" :key="m.modelRef || m.id"
              class="p-3 rounded-lg border transition-all cursor-pointer"
              :class="(selectedParamModel === (m.modelRef || m.id))
                ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-500/5'
                : 'border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600'"
              @click="selectedParamModel = m.modelRef || m.id"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 text-sm">
                    <span class="font-bold text-gray-800 dark:text-gray-100 truncate">{{ m.name }}</span>
                    <el-tag v-if="m.isVision" size="small" type="success" effect="plain" class="!text-[10px]">视觉</el-tag>
                    <el-tag v-if="!m.enabled" size="small" type="info" effect="plain" class="!text-[10px]">已禁用</el-tag>
                    <span v-if="m.ownerName" class="text-[11px] text-gray-400">{{ m.ownerName }}</span>
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate font-mono">{{ m.model }}</div>
                  <div class="text-[11px] text-gray-400 dark:text-gray-600 truncate">{{ m.baseURL }}</div>
                  <div class="text-[11px] text-gray-400 mt-0.5">Key: {{ m.apiKeyPreview || (m.hasApiKey ? '✓ 已配置' : '✗ 未配置') }}</div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <el-switch v-model="m.enabled" :disabled="!isOwnModel(m)" size="small" />
                  <el-button :loading="testingMap[m.modelRef || m.id]" size="small" text @click.stop="testModel(m)">测试</el-button>
                  <el-button v-if="isOwnModel(m)" size="small" text type="primary" @click.stop="editModel(m)">编辑</el-button>
                  <el-button v-if="isOwnModel(m)" size="small" text type="danger" @click.stop="removeModel(m.modelRef || m.id)">删除</el-button>
                </div>
              </div>
            </div>
            <div v-if="!filteredModels.length" class="text-center py-8 text-gray-400 text-sm">暂无模型，请在右侧添加</div>
          </div>
        </div>

        <!-- 参数调节 -->
        <div class="set-card">
          <div class="set-card-header">
            <span>参数调节</span>
            <el-select v-model="selectedParamModel" size="small" style="width: 200px" placeholder="选择模型" class="ml-auto">
              <el-option v-for="m in ownModelOptions" :key="`param-${m.value}`" :label="m.label" :value="m.value" />
            </el-select>
          </div>
          <div class="p-4" v-if="selectedModelEntity">
            <div class="mb-4">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                系统提示词
                <el-tooltip placement="top" effect="dark"><template #content><div class="max-w-xs"><div class="font-bold mb-1">System Prompt</div><div>{{ paramTooltips.systemPrompt.purpose }}</div></div></template><el-icon class="cursor-help text-gray-400 hover:text-blue-400" :size="12"><QuestionFilled /></el-icon></el-tooltip>
              </div>
              <el-input v-model="paramEditor.systemPrompt" type="textarea" :rows="2" @input="syncEditorToModel" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <div v-for="param in [
                { key: 'maxTokens', label: 'Max Tokens', min: 256, max: 32768, step: 256 },
                { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.01 },
                { key: 'topP', label: 'Top-P', min: 0, max: 1, step: 0.01 },
                { key: 'topK', label: 'Top-K', min: 0, max: 200, step: 1 },
                { key: 'minP', label: 'Min-P', min: 0, max: 1, step: 0.01 },
                { key: 'presencePenalty', label: 'Presence Penalty', min: -2, max: 2, step: 0.01 },
                { key: 'frequencyPenalty', label: 'Frequency Penalty', min: -2, max: 2, step: 0.01 },
                { key: 'repetitionPenalty', label: 'Repetition Penalty', min: 0, max: 2, step: 0.01 },
              ]" :key="param.key">
                <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span class="flex items-center gap-1">
                    {{ param.label }}
                    <el-tooltip v-if="paramTooltips[param.key]" placement="top" effect="dark"><template #content><div class="max-w-xs"><div class="font-bold mb-1">{{ param.label }}</div><div>{{ paramTooltips[param.key].purpose }}</div><div class="mt-1 text-xs text-gray-400">{{ paramTooltips[param.key].valueGuide }}</div></div></template><el-icon class="cursor-help text-gray-400 hover:text-blue-400" :size="12"><QuestionFilled /></el-icon></el-tooltip>
                  </span>
                  <span class="font-mono text-blue-500">{{ paramEditor[param.key] }}</span>
                </div>
                <el-slider v-model="paramEditor[param.key]" :min="param.min" :max="param.max" :step="param.step" @change="syncEditorToModel" />
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <span class="text-xs text-gray-500">启用思维链</span>
              <el-switch v-model="paramEditor.enableThinking" @change="syncEditorToModel" size="small" />
            </div>
          </div>
          <div v-else class="p-8 text-center text-gray-400 text-sm">请在模型列表中选择一个模型进行调参</div>
        </div>
      </div>

      <!-- ========== 右栏: 添加模型 + 默认设置 (占2列) ========== -->
      <div class="xl:col-span-2 space-y-4">
        <!-- 添加/编辑模型 -->
        <div class="set-card">
          <div class="set-card-header">
            <span>{{ editingRef ? '编辑模型' : '添加模型' }}</span>
            <el-button v-if="editingRef" size="small" text class="ml-auto" @click="cancelEdit">取消编辑</el-button>
          </div>
          <div class="p-4 space-y-3">
            <el-input v-model="modelForm.name" placeholder="模型显示名称" />
            <el-input v-if="!editingRef" v-model="modelForm.id" placeholder="模型别名（可选）" />
            <el-select v-model="modelForm.providerType" placeholder="Provider 类型" class="w-full">
              <el-option label="OpenAI 兼容" value="openai" />
              <el-option label="Anthropic" value="anthropic" />
            </el-select>
            <el-input v-model="modelForm.model" placeholder="模型ID，如 Qwen/Qwen3.5-397B-A17B" />
            <el-input v-model="modelForm.baseURL" placeholder="Base URL" />
            <el-input v-model="modelForm.apiKey" show-password :placeholder="editingRef ? 'API Key（不填则保持原值）' : 'API Key'" />
            <div class="flex items-center gap-4">
              <el-switch v-model="modelForm.enabled" active-text="启用" />
              <el-switch v-model="modelForm.isVision" active-text="视觉" />
            </div>
            <div class="flex gap-2">
              <el-button v-if="editingRef" type="primary" @click="updateModel" class="flex-1">更新模型</el-button>
              <el-button v-else type="primary" @click="addModel" class="flex-1">添加模型</el-button>
              <el-button :loading="testingMap.new" @click="testNewModel">连通测试</el-button>
            </div>
          </div>
        </div>

        <!-- 默认模型 -->
        <div class="set-card">
          <div class="set-card-header"><span>默认模型</span></div>
          <div class="p-4 space-y-3">
            <div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">聊天/问答</div>
              <el-select v-model="defaults.chatModel" placeholder="选择默认模型" class="w-full">
                <el-option v-for="m in allEnabledModelOptions" :key="`chat-${m.value}`" :label="m.label" :value="m.value" />
              </el-select>
            </div>
            <div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">个股分析</div>
              <el-select v-model="defaults.analysisModel" placeholder="选择默认模型" class="w-full">
                <el-option v-for="m in allEnabledModelOptions" :key="`analysis-${m.value}`" :label="m.label" :value="m.value" />
              </el-select>
            </div>
            <div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">图片识别</div>
              <el-select v-model="defaults.visionModel" placeholder="选择默认模型" class="w-full">
                <el-option v-for="m in allEnabledModelOptions" :key="`vision-${m.value}`" :label="m.label" :value="m.value" />
              </el-select>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.set-card {
  background: white;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
}
.set-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #f5f5f5;
}
:root.dark .set-card, html.dark .set-card { background: #111827; border-color: #1f2937; }
:root.dark .set-card-header, html.dark .set-card-header { color: #e5e7eb; border-bottom-color: #1f2937; }
</style>
