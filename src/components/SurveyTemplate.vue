<template>
  <div class="app-container">
    <!-- Progress Bar -->
    <div v-if="currentStep === 'survey'" class="progress-bar">
      <div class="progress" :style="{ width: `${progress}%` }"></div>
    </div>

    <!-- Survey Tabs (only show when in survey mode and there are surveys) -->
    <div v-if="currentStep === 'survey' && surveys.length > 0" class="survey-tabs-container">
      <div class="survey-tabs">
        <div
          v-for="(survey, index) in surveys"
          :key="survey.id"
          :class="['survey-tab-wrapper', { 'active': index === activeSurveyIndex }]"
        >
          <button
            @click="switchToSurvey(index)"
            :class="['survey-tab', { 'active': index === activeSurveyIndex, 'completed': survey.isSurveyComplete }]"
          >
            {{ survey.label }}
            <span v-if="survey.isSurveyComplete" class="completed-badge">✓</span>
          </button>
          <button
            @click="showSurveyInfo(index, $event)"
            class="survey-info-btn"
            title="Info / Renommer"
          >
            ℹ️
          </button>
        </div>
      </div>
      <button @click="startNewVehicleSurvey" class="btn-new-vehicle">
        + Nouveau Véhicule
      </button>
    </div>

    <div class="content-container">
      <!-- Enqueteur Input Step -->
      <div v-if="currentStep === 'enqueteur'">
        <h2>Prénom enqueteur :</h2>
        <input class="form-control" type="text" v-model="enqueteurInputRef" />
        <button
          v-if="enqueteurInputRef.trim()"
          @click="setEnqueteur"
          class="btn-next"
        >
          Suivant
        </button>
      </div>

      <!-- Start Survey Step (now potentially skipped if enqueteur is set) -->
      <div v-else-if="currentStep === 'start'" class="start-survey-container">
        <h2 v-html="props.welcomeMessage"></h2>
        <button @click="startSurveyActual" class="btn-next">
          COMMENCER QUESTIONNAIRE
        </button>
      </div>

      <!-- Survey Questions Step -->
      <div v-else-if="currentStep === 'survey' && !isSurveyComplete && currentQuestion">
        <div class="question-container">
          <h2>{{ currentQuestionText }}</h2>

          <!-- Question Image (if available) -->
          <div v-if="currentQuestion.image" class="question-image-container">
            <img 
              :src="currentQuestion.image" 
              :alt="currentQuestion.imageAlt || 'Image d\'aide pour la question'"
              class="question-image"
              loading="eager"
              @error="handleImageError"
              @click="openImageZoom"
            />
            <div class="zoom-hint">
              <span>👆 Appuyez pour agrandir</span>
            </div>
          </div>

          <!-- Commune Selector -->
          <div v-if="currentQuestion.type === 'commune'">
            <CommuneSelector
              v-model="selectedCommune"
              v-model:postalCodePrefix="postalCodePrefix"
            />
            <button
              @click="handleCommuneSelection"
              class="btn-next"
              :disabled="!selectedCommune.trim()"
            >
              {{ isLastQuestion ? "Départ véhicule" : "Suivant" }}
            </button>
          </div>

          <!-- Station (Gare) Selector -->
          <div v-else-if="currentQuestion.type === 'station'">
            <div class="input-container">
              <input 
                v-model="stationInput" 
                @input="filterStations" 
                class="form-control"
                placeholder="Saisir ou rechercher une station (bus, tram, etc.)"
              />
              <ul v-if="filteredStations.length && stationInput" class="autocomplete-results">
                <li 
                  v-for="(station, index) in filteredStations" 
                  :key="index" 
                  @click="selectStationFromList(station)"
                >
                  {{ station }}
                </li>
              </ul>
            </div>
            <button 
              @click="handleStationStreetInput(stationInput, 'station')" 
              class="btn-next" 
              :disabled="!stationInput.trim()"
            >
              {{ isLastQuestion ? "Départ véhicule" : "Suivant" }}
            </button>
          </div>

          <!-- Gare (Train Station) Selector -->
          <div v-else-if="currentQuestion.type === 'gare'">
            <GareSelector v-model="selectedGareName" />
            <button 
              @click="handleGareInput"
              class="btn-next" 
              :disabled="!selectedGareName || !selectedGareName.trim()"
            >
              {{ isLastQuestion ? "Départ véhicule" : "Suivant" }}
            </button>
          </div>

          <!-- Street Selector -->
          <div v-else-if="currentQuestion.type === 'street'">
            <div class="input-container">
              <input 
                v-model="streetInput" 
                @input="filterStreets" 
                class="form-control"
                placeholder="Saisir ou rechercher une rue"
              />
              <ul v-if="filteredStreets.length && streetInput" class="autocomplete-results">
                <li 
                  v-for="(street, index) in filteredStreets" 
                  :key="index" 
                  @click="selectStreetFromList(street)"
                >
                  {{ street }}
                </li>
              </ul>
            </div>
            <button 
              @click="handleStationStreetInput(streetInput, 'street')" 
              class="btn-next" 
              :disabled="!streetInput.trim()"
            >
              {{ isLastQuestion ? "Départ véhicule" : "Suivant" }}
            </button>
          </div>

          <!-- Multiple Choice Questions (checkboxes) -->
          <div v-else-if="currentQuestion.type === 'multipleChoice'">
            <div
              v-for="option in currentQuestion.options"
              :key="option.id"
              class="checkbox-option"
            >
              <label :for="`${currentQuestion.id}_${option.id}`" class="checkbox-label">
                <input
                  type="checkbox"
                  :id="`${currentQuestion.id}_${option.id}`"
                  :value="option.id"
                  v-model="multipleChoiceSelections"
                  class="checkbox-input"
                />
                {{ option.text }}
              </label>
            </div>
            <button
              v-if="multipleChoiceSelections.length > 0"
              @click="handleMultipleChoiceAnswer"
              class="btn-next"
            >
              {{ isLastQuestion ? "Départ véhicule" : "Suivant" }}
            </button>
          </div>
          
          <!-- Single Choice Questions (buttons) -->
          <div v-else-if="currentQuestion.type === 'singleChoice' && currentQuestion.options">
            <div
              v-for="(option) in currentQuestion.options"
              :key="option.id"
            >
              <button @click="selectAnswer(option)" class="btn-option">
                {{ option.text }}
              </button>
            </div>
          </div>

          <!-- Free Text Questions -->
          <div v-else-if="currentQuestion.type === 'freeText'">
            <div class="input-container">
              <input
                v-model="freeTextAnswer"
                class="form-control"
                :type="currentQuestion.validation === 'numeric' ? 'number' : 'text'"
                :placeholder="currentQuestion.freeTextPlaceholder || 'Votre réponse'"
                :inputmode="currentQuestion.validation === 'numeric' ? 'numeric' : undefined"
              />
            </div>
            <button
              @click="handleFreeTextAnswer"
              class="btn-next"
              :disabled="!isValidFreeTextAnswer()"
            >
              {{ isLastQuestion ? "Départ véhicule" : "Suivant" }}
            </button>
          </div>
          
          <!-- Fallback or Error for unknown question type -->
          <div v-else>
            <p style="color: red;">Erreur: Type de question non reconnu ou non défini pour QID: {{ currentQuestion.id }}. Définissez la propriété 'type'.</p>
          </div>

          <!-- Back Button -->
          <button @click="previousQuestion" class="btn-return" v-if="canGoBack">
            Retour
          </button>
        </div>
      </div>
      <div v-else-if="currentStep === 'survey' && !currentQuestion">
         <p>Chargement des questions...</p>
         <!-- Or an error if questions array is empty -->
         <div v-if="props.surveyQuestions && props.surveyQuestions.length === 0">
            <p style="color: red;">Aucune question n'a été chargée pour cette enquête.</p>
         </div>
      </div>


      <!-- Survey Complete Step -->
      <div v-else-if="isSurveyComplete" class="survey-complete">
        <h2>Merci pour votre réponse et bonne journée.</h2>
        <div class="survey-complete-actions">
          <button @click="removeSurvey(activeSurveyIndex)" class="btn-next">
            Fermer ce questionnaire
          </button>
          <button v-if="surveys.length === 1" @click="resetSurvey" class="btn-next">
            Nouveau questionnaire
          </button>
        </div>
      </div>

      <!-- Logo -->
      <img class="logo" src="../assets/Alycelogo.webp" alt="Logo Alyce" />
    </div>

    <!-- Image Zoom Modal -->
    <div v-if="showImageZoom" class="image-zoom-modal" @click="closeImageZoom">
      <div class="image-zoom-container" @click.stop>
        <button class="close-zoom" @click="closeImageZoom">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div 
          class="zoom-image-wrapper"
          ref="zoomWrapper"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @wheel="handleWheel"
        >
          <img 
            ref="zoomImage"
            :src="currentQuestion.image"
            :alt="currentQuestion.imageAlt || 'Image agrandie'"
            class="zoom-image"
            :style="imageTransform"
            @load="handleImageLoad"
          />
        </div>
      </div>
    </div>

    <!-- PDF Modal -->
    <div v-if="showPdf" class="modal">
      <div class="modal-content pdf-content">
        <button
          class="close"
          @click="
            () => {
              showPdf = false;
            }
          "
        >
          ×
        </button>
        <iframe
          :src="pdfUrl"
          width="100%"
          height="500px"
          type="application/pdf"
        >
          This browser does not support PDFs. Please download the PDF to view
          it.
        </iframe>
      </div>
    </div>

    <!-- Survey Info Modal -->
    <div v-if="showSurveyInfoModal && selectedSurveyForInfo !== null" class="modal" @click="closeSurveyInfoModal">
      <div class="modal-content survey-info-modal" @click.stop>
        <button class="close" @click="closeSurveyInfoModal">×</button>

        <h2>Informations du questionnaire</h2>

        <!-- Survey Name -->
        <div class="survey-info-section">
          <h3>Nom du véhicule</h3>
          <div v-if="!editingSurveyName" class="survey-name-display">
            <span>{{ surveys[selectedSurveyForInfo].label }}</span>
            <button @click="startEditingSurveyName" class="btn-edit">Renommer</button>
          </div>
          <div v-else class="survey-name-edit">
            <input
              v-model="newSurveyName"
              class="form-control"
              @keyup.enter="saveSurveyName"
            />
            <button @click="saveSurveyName" class="btn-save">Enregistrer</button>
            <button @click="editingSurveyName = false" class="btn-cancel">Annuler</button>
          </div>
        </div>

        <!-- Survey Time Info -->
        <div class="survey-info-section">
          <h3>Horaires</h3>
          <p><strong>Heure d'arrivée:</strong> {{ surveys[selectedSurveyForInfo].startDate || 'Non démarré' }}</p>
          <p><strong>Statut:</strong> {{ surveys[selectedSurveyForInfo].isSurveyComplete ? 'Terminé' : 'En cours' }}</p>
        </div>

        <!-- Survey Answers -->
        <div class="survey-info-section">
          <h3>Réponses</h3>
          <div v-if="getSurveyAnswersSummary(selectedSurveyForInfo).length === 0">
            <p>Aucune réponse enregistrée</p>
          </div>
          <div v-else class="survey-answers-list">
            <div
              v-for="(answer, idx) in getSurveyAnswersSummary(selectedSurveyForInfo)"
              :key="idx"
              class="answer-item"
            >
              <strong>{{ answer.question }}</strong>
              <span>{{ answer.answer }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="survey-info-actions">
          <button
            v-if="!surveys[selectedSurveyForInfo].isSurveyComplete"
            @click="switchToSurvey(selectedSurveyForInfo); closeSurveyInfoModal()"
            class="btn-next"
          >
            Continuer ce questionnaire
          </button>
          <button @click="removeSurvey(selectedSurveyForInfo); closeSurveyInfoModal()" class="btn-delete">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { db } from "../firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import CommuneSelector from "./CommuneSelector.vue";
import GareSelector from "./GareSelector.vue";

const props = defineProps({
  surveyQuestions: {
    type: Array,
    required: true,
  },
  firebaseCollectionName: {
    type: String,
    required: true,
  },
  stationsList: { 
    type: Array,
    default: () => []
  },
  streetsList: { 
    type: Array,
    default: () => []
  },
  posteTravailQuestionId: {
    type: String,
    default: null,
  },
  surveyTitle: {
    type: String,
    default: 'Enquête'
  },
  welcomeMessage: {
    type: String,
    default: 'Bonjour Madame/Monsieur'
  },
  rememberPosteTravail: {
    type: Boolean,
    default: true,
  },
});

// Multiple Survey Management
const surveys = ref([]);
const activeSurveyIndex = ref(0);
const nextSurveyId = ref(1);

// Survey info modal
const showSurveyInfoModal = ref(false);
const selectedSurveyForInfo = ref(null);
const editingSurveyName = ref(false);
const newSurveyName = ref("");

// Enqueteur state (shared across all surveys)
const currentStep = ref("enqueteur");
const enqueteurInputRef = ref("");
const savedEnqueteur = ref("");

// Added for remembering Poste de Travail (shared across all surveys)
const savedPosteTravailValue = ref(null);
const savedPosteTravailText = ref("");
const savedPosteTravailOptionIndex = ref(-1);

// Helper to get active survey
const activeSurvey = computed(() => {
  if (surveys.value.length === 0) return null;
  return surveys.value[activeSurveyIndex.value];
});

// Computed properties that delegate to active survey
const startDate = computed({
  get: () => activeSurvey.value?.startDate || "",
  set: (val) => { if (activeSurvey.value) activeSurvey.value.startDate = val; }
});
const currentQuestionIndex = computed({
  get: () => activeSurvey.value?.currentQuestionIndex || 0,
  set: (val) => { if (activeSurvey.value) activeSurvey.value.currentQuestionIndex = val; }
});
const currentQuestion = computed({
  get: () => activeSurvey.value?.currentQuestion || null,
  set: (val) => { if (activeSurvey.value) activeSurvey.value.currentQuestion = val; }
});
const answers = computed({
  get: () => activeSurvey.value?.answers || { question_answers: [] },
  set: (val) => { if (activeSurvey.value) activeSurvey.value.answers = val; }
});
const freeTextAnswer = computed({
  get: () => activeSurvey.value?.freeTextAnswer || "",
  set: (val) => { if (activeSurvey.value) activeSurvey.value.freeTextAnswer = val; }
});
const multipleChoiceSelections = computed({
  get: () => activeSurvey.value?.multipleChoiceSelections || [],
  set: (val) => { if (activeSurvey.value) activeSurvey.value.multipleChoiceSelections = val; }
});
const questionPath = computed({
  get: () => activeSurvey.value?.questionPath || [],
  set: (val) => { if (activeSurvey.value) activeSurvey.value.questionPath = val; }
});
const isSurveyComplete = computed({
  get: () => activeSurvey.value?.isSurveyComplete || false,
  set: (val) => { if (activeSurvey.value) activeSurvey.value.isSurveyComplete = val; }
});
const isFinishing = computed({
  get: () => activeSurvey.value?.isFinishing || false,
  set: (val) => { if (activeSurvey.value) activeSurvey.value.isFinishing = val; }
});
const selectedCommune = computed({
  get: () => activeSurvey.value?.selectedCommune || "",
  set: (val) => { if (activeSurvey.value) activeSurvey.value.selectedCommune = val; }
});
const postalCodePrefix = computed({
  get: () => activeSurvey.value?.postalCodePrefix || "",
  set: (val) => { if (activeSurvey.value) activeSurvey.value.postalCodePrefix = val; }
});
const stationInput = computed({
  get: () => activeSurvey.value?.stationInput || "",
  set: (val) => { if (activeSurvey.value) activeSurvey.value.stationInput = val; }
});
const streetInput = computed({
  get: () => activeSurvey.value?.streetInput || "",
  set: (val) => { if (activeSurvey.value) activeSurvey.value.streetInput = val; }
});
const filteredStations = computed({
  get: () => activeSurvey.value?.filteredStations || [],
  set: (val) => { if (activeSurvey.value) activeSurvey.value.filteredStations = val; }
});
const filteredStreets = computed({
  get: () => activeSurvey.value?.filteredStreets || [],
  set: (val) => { if (activeSurvey.value) activeSurvey.value.filteredStreets = val; }
});
const selectedGareName = computed({
  get: () => activeSurvey.value?.selectedGareName || "",
  set: (val) => { if (activeSurvey.value) activeSurvey.value.selectedGareName = val; }
});

// UI State
const showPdf = ref(false);
const pdfUrl = ref("/Plan.pdf");

// Image Zoom State
const showImageZoom = ref(false);
const zoomLevel = ref(1);
const panX = ref(0);
const panY = ref(0);
const lastTouchDistance = ref(0);
const isDragging = ref(false);
const lastTouchX = ref(0);
const lastTouchY = ref(0);
const zoomWrapper = ref(null);
const zoomImage = ref(null);

// Firestore References
const surveyCollectionRef = computed(() =>
  collection(db, props.firebaseCollectionName)
);
const counterDocRef = computed(() =>
  doc(db, `${props.firebaseCollectionName}counters`, "surveyCounter")
);
const docCount = ref(0);

// Computed Properties
const currentQuestionText = computed(() => {
  if (!currentQuestion.value) return "";

  if (currentQuestion.value.conditionalText) {
    const conditionalTextBlock = currentQuestion.value.conditionalText;
    let specificText = null;

    const conditions = Array.isArray(conditionalTextBlock) ? conditionalTextBlock : [conditionalTextBlock];

    for (const condBlock of conditions) {
      const conditionQuestionId = condBlock.condition;
      const conditionAnswer = getAnswerById(conditionQuestionId);

      if (conditionAnswer !== undefined && conditionAnswer !== null) {
        for (const route of condBlock.routes) {
          if (conditionAnswer.optionId === route.value || 
              (Array.isArray(conditionAnswer.optionId) && conditionAnswer.optionId.includes(route.value)) ||
              conditionAnswer.answer === route.value 
             ) {
            specificText = route.text;
            break; 
          }
        }
      }
      if (specificText) break; 
    }
    if (specificText) return specificText;
  }
  return currentQuestion.value.text;
});

const canGoBack = computed(() => questionPath.value.length > 1);

const isLastQuestion = computed(() => {
    if (!currentQuestion.value || !props.surveyQuestions || props.surveyQuestions.length === 0) return true;
    const localCurrentIndex = props.surveyQuestions.findIndex(q => q.id === currentQuestion.value.id);
    if (localCurrentIndex === -1) return true;

    if (localCurrentIndex === props.surveyQuestions.length - 1) return true;
    if (currentQuestion.value.next === 'end') return true;
    if (currentQuestion.value.options && currentQuestion.value.options.every(opt => opt.next === 'end')) return true;
    return false;
});

const progress = computed(() => {
  if (currentStep.value !== "survey" || !props.surveyQuestions || props.surveyQuestions.length === 0 || !currentQuestion.value) return 0;
  if (isSurveyComplete.value) return 100;
  
  const totalQuestions = props.surveyQuestions.length;
  const localCurrentIndex = props.surveyQuestions.findIndex(q => q.id === currentQuestion.value.id);
  if (localCurrentIndex === -1) return 0;
  const currentQuestionNumber = localCurrentIndex + 1;

  if (isLastQuestion.value) return 100;

  return Math.min(Math.round((currentQuestionNumber / totalQuestions) * 100), 99);
});

const imageTransform = computed(() => {
  return {
    transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoomLevel.value})`,
    transition: isDragging.value ? 'none' : 'transform 0.3s ease-out'
  };
});

// Methods

// Create a new survey instance
const createNewSurvey = (label = null) => {
  const surveyId = nextSurveyId.value++;
  const surveyLabel = label || `Véhicule ${surveyId}`;

  const newSurvey = {
    id: surveyId,
    label: surveyLabel,
    startDate: "",
    currentQuestionIndex: 0,
    currentQuestion: null,
    answers: { question_answers: [] },
    freeTextAnswer: "",
    multipleChoiceSelections: [],
    questionPath: [],
    isSurveyComplete: false,
    isFinishing: false,
    selectedCommune: "",
    postalCodePrefix: "",
    stationInput: "",
    streetInput: "",
    filteredStations: [],
    filteredStreets: [],
    selectedGareName: "",
  };

  surveys.value.push(newSurvey);
  return surveys.value.length - 1; // Return the index of the new survey
};

// Switch to a different survey
const switchToSurvey = (index) => {
  if (index >= 0 && index < surveys.value.length) {
    activeSurveyIndex.value = index;
  }
};

// Remove a completed survey
const removeSurvey = (index) => {
  if (surveys.value.length > 1) {
    surveys.value.splice(index, 1);
    // Adjust active index if needed
    if (activeSurveyIndex.value >= surveys.value.length) {
      activeSurveyIndex.value = surveys.value.length - 1;
    }
  } else {
    // If it's the last survey, just reset it
    const surveyIndex = createNewSurvey();
    surveys.value.splice(index, 1);
    activeSurveyIndex.value = 0;
  }
};

// Start a new survey for a new vehicle (called from UI button)
const startNewVehicleSurvey = () => {
  const newIndex = createNewSurvey();
  switchToSurvey(newIndex);
  // Initialize the survey
  initializeSurvey();
};

// Show survey info modal
const showSurveyInfo = (index, event) => {
  event.stopPropagation(); // Prevent switching to the survey
  selectedSurveyForInfo.value = index;
  const survey = surveys.value[index];
  newSurveyName.value = survey.label;
  showSurveyInfoModal.value = true;
  editingSurveyName.value = false;
};

// Close survey info modal
const closeSurveyInfoModal = () => {
  showSurveyInfoModal.value = false;
  selectedSurveyForInfo.value = null;
  editingSurveyName.value = false;
};

// Start editing survey name
const startEditingSurveyName = () => {
  editingSurveyName.value = true;
};

// Save new survey name
const saveSurveyName = () => {
  if (selectedSurveyForInfo.value !== null && newSurveyName.value.trim()) {
    surveys.value[selectedSurveyForInfo.value].label = newSurveyName.value.trim();
    editingSurveyName.value = false;
  }
};

// Get survey answers summary
const getSurveyAnswersSummary = (surveyIndex) => {
  const survey = surveys.value[surveyIndex];
  if (!survey || !survey.answers || !survey.answers.question_answers) {
    return [];
  }
  return survey.answers.question_answers.map(qa => ({
    question: qa.questionText,
    answer: qa.optionText
  }));
};

// Initialize survey (replaces part of startSurveyActual logic)
const initializeSurvey = () => {
  const now = new Date();
  if (activeSurvey.value) {
    activeSurvey.value.startDate = now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    activeSurvey.value.answers = { question_answers: [] };
    activeSurvey.value.freeTextAnswer = "";
    activeSurvey.value.multipleChoiceSelections = [];
    activeSurvey.value.selectedCommune = "";
    activeSurvey.value.postalCodePrefix = "";
    activeSurvey.value.stationInput = "";
    activeSurvey.value.streetInput = "";
    activeSurvey.value.selectedGareName = "";
    activeSurvey.value.filteredStations = [];
    activeSurvey.value.filteredStreets = [];
  }

  let firstQuestionId;
  const posteTravailQId = props.posteTravailQuestionId;

  // If we have a remembered POSTE value, record it in this survey's answers
  if (posteTravailQId && savedPosteTravailValue.value !== null && savedPosteTravailText.value && activeSurvey.value) {
    const posteQuestion = findQuestionById(posteTravailQId);
    if (posteQuestion) {
        // Record the remembered POSTE value in this survey's answers
        recordAnswerToState(
            posteTravailQId,
            posteQuestion.text,
            savedPosteTravailValue.value,
            savedPosteTravailText.value,
            savedPosteTravailOptionIndex.value !== -1 ? savedPosteTravailOptionIndex.value : undefined
        );

        const matchedOption = posteQuestion.options
            ? posteQuestion.options.find(opt => opt.id === savedPosteTravailValue.value)
            : null;
        firstQuestionId = getNextQuestionId(posteQuestion, matchedOption);
         if (!firstQuestionId || firstQuestionId === posteTravailQId) {
            if (props.surveyQuestions && props.surveyQuestions.length > 0) {
                 const firstSurveyQuestion = props.surveyQuestions.find(q => q.id !== posteTravailQId);
                 firstQuestionId = firstSurveyQuestion ? firstSurveyQuestion.id : (props.surveyQuestions[0] ? props.surveyQuestions[0].id : null);
                 if (!firstQuestionId && props.surveyQuestions[0] && props.surveyQuestions[0].id === posteTravailQId && props.surveyQuestions.length > 1) {
                    firstQuestionId = props.surveyQuestions[1].id;
                 } else if (!firstQuestionId && props.surveyQuestions[0]) {
                    firstQuestionId = props.surveyQuestions[0].id;
                 }
            } else {
                firstQuestionId = null;
            }
        }
    } else {
        firstQuestionId = props.surveyQuestions && props.surveyQuestions.length > 0 ? props.surveyQuestions[0].id : null;
    }
  } else {
    firstQuestionId = props.surveyQuestions && props.surveyQuestions.length > 0 ? props.surveyQuestions[0].id : null;
  }

  if (activeSurvey.value) {
    activeSurvey.value.currentQuestion = findQuestionById(firstQuestionId);
    if (activeSurvey.value.currentQuestion) {
      activeSurvey.value.questionPath = [activeSurvey.value.currentQuestion.id];

      // Scroll to top when starting survey, with delay to prevent conflicts
      nextTick(() => {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }, 50);
      });
    } else if (firstQuestionId === 'end'){
      finishSurvey();
    } else {
      console.error("Could not determine the first question. SurveyQuestions length:", props.surveyQuestions?.length);
    }
  }
};

const setEnqueteur = () => {
  if (enqueteurInputRef.value.trim() !== "") {
    savedEnqueteur.value = enqueteurInputRef.value.trim();
    currentStep.value = "start";
  } else {
    alert("Veuillez entrer le prénom de l'enquêteur.");
  }
};

const startSurveyActual = () => {
  // Create the first survey instance
  if (surveys.value.length === 0) {
    createNewSurvey();
    activeSurveyIndex.value = 0;
  }

  currentStep.value = "survey";

  // Initialize the first survey
  initializeSurvey();
};

const recordAnswerToState = (questionId, questionText, optionId, optionText, optionIndex = -1) => {
  questionId = String(questionId);
  if (!answers.value.question_answers) {
    answers.value.question_answers = [];
  }
  const existingIndex = answers.value.question_answers.findIndex(
    (qa) => qa.questionId === questionId
  );
  if (existingIndex !== -1) {
    answers.value.question_answers.splice(existingIndex, 1);
  }
  answers.value.question_answers.push({
    questionId: questionId,
    questionText: questionText,
    optionId: optionId,
    optionText: optionText,
    optionIndex: optionIndex,
  });
  answers.value[questionId] = optionId; 

  if (props.posteTravailQuestionId && questionId === String(props.posteTravailQuestionId)) {
    savedPosteTravailValue.value = optionId;
    savedPosteTravailText.value = optionText;
    savedPosteTravailOptionIndex.value = optionIndex;
  }
};

const selectAnswer = (selectedOption) => {
  if (!currentQuestion.value) return;
  const optionIndex = currentQuestion.value.options 
    ? currentQuestion.value.options.findIndex(opt => opt.id === selectedOption.id)
    : -1;

  recordAnswerToState(
    currentQuestion.value.id, 
    currentQuestionText.value,
    selectedOption.id,
    selectedOption.text,
    optionIndex
  );
  
  // NEW: Check if this option has a condition
  let effectiveOption = selectedOption;
  if (selectedOption.condition) {
    const conditionMet = evaluateCondition(selectedOption.condition);
    if (!conditionMet && selectedOption.fallbackNext) {
      // Create a new option object with the fallback next
      effectiveOption = { ...selectedOption, next: selectedOption.fallbackNext };
    }
  }
  
  nextQuestion(effectiveOption);
};

const handleMultipleChoiceAnswer = () => {
  if (!currentQuestion.value || multipleChoiceSelections.value.length === 0) return;
  const questionIdStr = String(currentQuestion.value.id);

  const selectedOptionsDetails = multipleChoiceSelections.value.map(numericOptionId => {
    return currentQuestion.value.options.find(opt => opt.id === numericOptionId);
  }).filter(opt => opt);

  const combinedOptionText = selectedOptionsDetails.map(opt => opt.text).join(", ");
  recordAnswerToState(
    questionIdStr,
    currentQuestionText.value,
    multipleChoiceSelections.value,
    combinedOptionText
  );
  
  // Check if any selected option has next_if_selected (for precision questions)
  const optionWithPrecision = selectedOptionsDetails.find(opt => opt.next_if_selected);
  
  if (optionWithPrecision) {
    // Route to the precision question
    const precisionQuestionId = optionWithPrecision.next_if_selected;
    
    const precisionQuestion = findQuestionById(precisionQuestionId);
    if (precisionQuestion) {
      currentQuestion.value = precisionQuestion;
      questionPath.value.push(precisionQuestion.id);
      freeTextAnswer.value = "";
      multipleChoiceSelections.value = [];
      selectedCommune.value = "";
      postalCodePrefix.value = "";
      stationInput.value = "";
      streetInput.value = "";
      selectedGareName.value = "";
      return;
    }
  }
  
  nextQuestion(null);
};

// Helper function to check if free text answer is valid
// This is especially important for numeric questions where 0 is a valid response
const isValidFreeTextAnswer = () => {
  if (!currentQuestion.value) return false;
  if (freeTextAnswer.value === null || freeTextAnswer.value === undefined) return false;
  
  const answerStr = String(freeTextAnswer.value).trim();
  
  // For numeric questions, 0 is a valid response
  if (currentQuestion.value.validation === 'numeric') {
    // Check if it's a valid number
    const numValue = Number(freeTextAnswer.value);
    return !isNaN(numValue) && isFinite(numValue);
  }
  
  // For non-numeric questions, check if not empty
  return answerStr !== '';
};

const handleFreeTextAnswer = () => {
  if (!currentQuestion.value || !isValidFreeTextAnswer()) return;
  
  // Convert to string and trim for validation
  const answerValue = String(freeTextAnswer.value).trim();
  if (!answerValue && currentQuestion.value.validation !== 'numeric') return;
  
  recordAnswerToState(
    currentQuestion.value.id,
    currentQuestionText.value,
    freeTextAnswer.value, // Use original value (could be number)
    answerValue // Use trimmed string for display
  );
  nextQuestion(null);
};

const handleCommuneSelection = () => {
  if (!currentQuestion.value || !selectedCommune.value.trim()) return;
  
  const questionId = currentQuestion.value.id;
  
  // Parse the selectedCommune value (format: "COMMUNE - CODE_INSEE" or just "COMMUNE")
  const communeValue = selectedCommune.value.trim();
  let communeName = communeValue;
  let codeInsee = '';
  let communeLibre = '';
  
  if (communeValue.includes(' - ')) {
    // Selected from dropdown (format: "COMMUNE - CODE_INSEE")
    const parts = communeValue.split(' - ');
    communeName = parts[0];
    codeInsee = parts[1] || '';
  } else {
    // Free text input (user typed something not in the list)
    communeLibre = communeValue;
    communeName = '';
  }
  
  // Record the main commune field
  recordAnswerToState(
    questionId,
    currentQuestionText.value,
    communeName,
    communeName
  );
  
  // Record the CODE INSEE field if available
  if (codeInsee) {
    recordAnswerToState(
      `${questionId}_CODE_INSEE`,
      `${currentQuestionText.value} - Code INSEE`,
      codeInsee,
      codeInsee
    );
  }
  
  // Record the COMMUNE_LIBRE field if it's free text
  if (communeLibre) {
    recordAnswerToState(
      `${questionId}_COMMUNE_LIBRE`,
      `${currentQuestionText.value} - Commune libre`,
      communeLibre,
      communeLibre
    );
  }
  
  nextQuestion(null);
};

const handleStationStreetInput = (value, inputType) => {
  if (!currentQuestion.value || !value.trim()) return;
  recordAnswerToState(
    currentQuestion.value.id,
    currentQuestionText.value,
    value.trim(),
    value.trim()
  );
  nextQuestion(null);
};

const handleGareInput = () => {
  if (!currentQuestion.value || !selectedGareName.value || !selectedGareName.value.trim()) return;
  recordAnswerToState(
    currentQuestion.value.id,
    currentQuestionText.value,
    selectedGareName.value.trim(),
    selectedGareName.value.trim()
  );
  nextQuestion(null);
};

const nextQuestion = async (selectedOption = null) => {
  let nextId = getNextQuestionId(currentQuestion.value, selectedOption);

  // Check if the target question has a condition and skip it if not met
  while (nextId && nextId !== 'end') {
    const nextQObject = findQuestionById(nextId);
    if (nextQObject && nextQObject.condition) {
      const shouldShowQuestion = evaluateCondition(nextQObject.condition);
      if (!shouldShowQuestion) {
        // Skip this question and find the next one
        
        let fallbackNextId = null;
        
        // First, try to use the question's fallbackNext property
        if (nextQObject.fallbackNext) {
          fallbackNextId = nextQObject.fallbackNext;
        } else {
          // Try to get the next question from the skipped question
          fallbackNextId = getNextQuestionId(nextQObject, null);
          
          // If that also returns null, try to find the next question in sequence
          if (!fallbackNextId) {
            const currentIndex = props.surveyQuestions.findIndex(q => q.id === nextId);
            if (currentIndex !== -1 && currentIndex < props.surveyQuestions.length - 1) {
              fallbackNextId = props.surveyQuestions[currentIndex + 1].id;
            } else {
              // Final safety fallback - end the survey if we can't find the next question
              fallbackNextId = 'end';
            }
          }
        }
        
        nextId = fallbackNextId;
        continue;
      }
    }
    break; // Question should be shown or no condition
  }

  if (nextId === 'end') {
    await finishSurvey();
  } else if (nextId) {
    const nextQObject = findQuestionById(nextId);
    if (nextQObject) {
      currentQuestion.value = nextQObject;
      questionPath.value.push(nextQObject.id);
      freeTextAnswer.value = "";
      multipleChoiceSelections.value = [];
      selectedCommune.value = ""; 
      postalCodePrefix.value = ""; 
      stationInput.value = "";
      streetInput.value = "";
      selectedGareName.value = "";
      currentQuestionIndex.value = props.surveyQuestions.findIndex(q => q.id === nextQObject.id);
      
      // Scroll to top for new question after DOM updates, with a small delay to prevent conflicts
      nextTick(() => {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }, 50);
      });
    } else {
      console.error(`CRITICAL ERROR: Next question with ID '${nextId}' not found.`);
      await finishSurvey();
    }
  } else {
    console.error("CRITICAL ERROR: No next question ID could be determined.");
    await finishSurvey();
  }
};

const previousQuestion = () => {
  if (!canGoBack.value) return;
  questionPath.value.pop();
  const previousQuestionIdStr = questionPath.value[questionPath.value.length - 1];
  
  const previousQObject = findQuestionById(previousQuestionIdStr);

  if (previousQObject) {
    currentQuestion.value = previousQObject;
    currentQuestionIndex.value = props.surveyQuestions.findIndex(q => q.id === previousQObject.id);
    freeTextAnswer.value = "";
    multipleChoiceSelections.value = [];
    selectedCommune.value = "";
    postalCodePrefix.value = "";
    stationInput.value = "";
    streetInput.value = "";
    selectedGareName.value = "";
    
    // Scroll to top when going back to previous question, with delay to prevent conflicts
    nextTick(() => {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 50);
    });
  } else {
      console.error("Error going back: Could not find previous question ID in path or props:", previousQuestionIdStr);
  }
};

const finishSurvey = async () => {
  if (!activeSurvey.value || activeSurvey.value.isFinishing) return;
  activeSurvey.value.isFinishing = true;

  try {
    const capturedStartDate = activeSurvey.value.startDate;
    const capturedAnswersData = JSON.parse(JSON.stringify(activeSurvey.value.answers));
    const capturedEnqueteur = savedEnqueteur.value;
    let capturedPosteTravail = null;

    // First try to get from savedPosteTravailValue (session memory)
    if (props.posteTravailQuestionId && savedPosteTravailValue.value !== null) {
      capturedPosteTravail = savedPosteTravailValue.value;
    }

    // If not found in session, try to get from current answers
    if (!capturedPosteTravail && props.posteTravailQuestionId && capturedAnswersData.question_answers) {
      const posteAnswerObj = capturedAnswersData.question_answers.find(
        qa => qa.questionId === props.posteTravailQuestionId
      );
      if (posteAnswerObj) {
        capturedPosteTravail = posteAnswerObj.optionId;
      }
    }

    // If still not found, try direct property access
    if (!capturedPosteTravail && props.posteTravailQuestionId && capturedAnswersData[props.posteTravailQuestionId]) {
      capturedPosteTravail = capturedAnswersData[props.posteTravailQuestionId];
    }

    activeSurvey.value.isSurveyComplete = true;
    const now = new Date();
    const uniqueSurveyInstanceId = await getNextId();

    const surveyResult = {
      ID_questionnaire: uniqueSurveyInstanceId,
      firebase_timestamp: new Date().toISOString(),
      HEURE_DEBUT: capturedStartDate || "",
      DATE: now.toLocaleDateString("fr-FR").replace(/\//g, "-"),
      JOUR: ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi",][now.getDay()],
      HEURE_FIN: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      ENQUETEUR: capturedEnqueteur,
    };

    // Add POSTE_TRAVAIL if available (legacy field for compatibility)
    if (capturedPosteTravail !== null) {
      surveyResult.POSTE_TRAVAIL = capturedPosteTravail;
    }

    // Sort answers by their position in the original surveyQuestions array
    const sortedAnswers = capturedAnswersData.question_answers ?
      capturedAnswersData.question_answers.sort((a, b) => {
        const indexA = props.surveyQuestions.findIndex(q => q.id === a.questionId);
        const indexB = props.surveyQuestions.findIndex(q => q.id === b.questionId);
        return indexA - indexB;
      }) : [];

    // Add sorted answers to surveyResult
    sortedAnswers.forEach(qa => {
      surveyResult[qa.questionId] = qa.optionId;
    });

    // Ensure POSTE question ID is always saved (even if not explicitly answered in this session)
    if (props.posteTravailQuestionId && capturedPosteTravail !== null) {
      // Make sure the POSTE question ID is in the result (this ensures it appears in Excel)
      surveyResult[props.posteTravailQuestionId] = capturedPosteTravail;
    }

    await addDoc(surveyCollectionRef.value, surveyResult);

    // Auto-remove completed survey from tabs
    const completedIndex = activeSurveyIndex.value;
    setTimeout(() => {
      removeSurvey(completedIndex);
    }, 100); // Small delay to ensure state updates properly

  } catch (error) {
    console.error("Error saving survey:", error);
  } finally {
    if (activeSurvey.value) {
      activeSurvey.value.isFinishing = false;
    }
  }
};

const resetSurvey = () => {
  if (!activeSurvey.value || activeSurvey.value.isFinishing) {
    console.warn("Reset prevented: Survey is currently being finished.");
    return;
  }

  // Reset the current survey instead of creating a new one
  const currentIndex = activeSurveyIndex.value;

  // Reinitialize the current survey
  surveys.value[currentIndex].answers = { question_answers: [] };
  surveys.value[currentIndex].freeTextAnswer = "";
  surveys.value[currentIndex].multipleChoiceSelections = [];
  surveys.value[currentIndex].isSurveyComplete = false;
  surveys.value[currentIndex].isFinishing = false;
  surveys.value[currentIndex].selectedCommune = "";
  surveys.value[currentIndex].postalCodePrefix = "";
  surveys.value[currentIndex].stationInput = "";
  surveys.value[currentIndex].streetInput = "";
  surveys.value[currentIndex].selectedGareName = "";
  surveys.value[currentIndex].filteredStations = [];
  surveys.value[currentIndex].filteredStreets = [];
  surveys.value[currentIndex].questionPath = [];

  // Initialize the survey
  initializeSurvey();
};

const getDocCount = async () => {
  try {
    const querySnapshot = await getDocs(surveyCollectionRef.value);
    docCount.value = querySnapshot.size;
  } catch (error) {
    console.error("Error getting document count:", error);
  }
};

const getNextId = async () => {
  try {
    const currentCounterDocRef = counterDocRef.value;
    const counterDocSnap = await getDoc(currentCounterDocRef);
    let counter = 1;
    if (counterDocSnap.exists()) {
      counter = counterDocSnap.data().value + 1;
    }
    await setDoc(currentCounterDocRef, { value: counter });
    const prefix = props.firebaseCollectionName.substring(0,3).toUpperCase();
    return `${prefix}-${new Date().toISOString().split('T')[0]}-${counter.toString().padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating next ID for submission:", error);
    return `ERR-${Date.now()}`;
  }
};

onMounted(() => {
  getDocCount();
  // console.log(`SurveyTemplate.vue mounted. Collection: ${props.firebaseCollectionName}, Questions: ${props.surveyQuestions?.length || 0}, Poste Question ID: ${props.posteTravailQuestionId || 'N/A'}`);
});

watch(stationInput, () => {
  filterStations(); 
});

watch(streetInput, () => {
  filterStreets();
});

const filterStations = () => {
  if (!stationInput.value) {
    filteredStations.value = [];
    return;
  }
  const inputLower = stationInput.value.toLowerCase();
  filteredStations.value = Array.isArray(props.stationsList) 
    ? props.stationsList.filter(station => station.toLowerCase().includes(inputLower))
    : [];
};

const selectStationFromList = (station) => {
  stationInput.value = station;
  filteredStations.value = [];
};

const filterStreets = () => {
  if (!streetInput.value) {
    filteredStreets.value = [];
    return;
  }
  const inputLower = streetInput.value.toLowerCase();
  filteredStreets.value = Array.isArray(props.streetsList)
    ? props.streetsList.filter(street => street.toLowerCase().includes(inputLower))
    : [];
};

const selectStreetFromList = (street) => {
  streetInput.value = street;
  filteredStreets.value = [];
};

const handleImageError = (event) => {
  console.warn('Failed to load question image:', event.target.src);
  event.target.style.display = 'none';
};

// Image Zoom Methods
const openImageZoom = () => {
  showImageZoom.value = true;
  resetZoom();
};

const closeImageZoom = () => {
  showImageZoom.value = false;
  resetZoom();
};

const resetZoom = () => {
  zoomLevel.value = 1;
  panX.value = 0;
  panY.value = 0;
  isDragging.value = false;
};

const constrainPan = () => {
  if (!zoomWrapper.value || !zoomImage.value) return;
  
  const wrapper = zoomWrapper.value;
  const image = zoomImage.value;
  
  const wrapperRect = wrapper.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();
  
  const maxPanX = Math.max(0, (imageRect.width - wrapperRect.width) / 2);
  const maxPanY = Math.max(0, (imageRect.height - wrapperRect.height) / 2);
  
  panX.value = Math.max(-maxPanX, Math.min(maxPanX, panX.value));
  panY.value = Math.max(-maxPanY, Math.min(maxPanY, panY.value));
};

const handleImageLoad = () => {
  // Reset zoom when image loads
  resetZoom();
};

// Touch and Mouse Event Handlers
const handleTouchStart = (event) => {
  event.preventDefault();
  
  if (event.touches.length === 1) {
    // Single touch - start dragging
    isDragging.value = true;
    lastTouchX.value = event.touches[0].clientX;
    lastTouchY.value = event.touches[0].clientY;
  } else if (event.touches.length === 2) {
    // Two fingers - start pinch zoom
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    lastTouchDistance.value = distance;
    isDragging.value = false;
  }
};

const handleTouchMove = (event) => {
  event.preventDefault();
  
  if (event.touches.length === 1 && isDragging.value) {
    // Single touch - pan the image
    const deltaX = event.touches[0].clientX - lastTouchX.value;
    const deltaY = event.touches[0].clientY - lastTouchY.value;
    
    panX.value += deltaX;
    panY.value += deltaY;
    
    lastTouchX.value = event.touches[0].clientX;
    lastTouchY.value = event.touches[0].clientY;
    
    constrainPan();
  } else if (event.touches.length === 2) {
    // Two fingers - pinch zoom
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    
    if (lastTouchDistance.value > 0) {
      const scale = distance / lastTouchDistance.value;
      const newZoom = Math.max(0.5, Math.min(4, zoomLevel.value * scale));
      zoomLevel.value = newZoom;
      constrainPan();
    }
    
    lastTouchDistance.value = distance;
  }
};

const handleTouchEnd = (event) => {
  event.preventDefault();
  isDragging.value = false;
  lastTouchDistance.value = 0;
};

const handleWheel = (event) => {
  event.preventDefault();
  
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.5, Math.min(4, zoomLevel.value * delta));
  zoomLevel.value = newZoom;
  constrainPan();
};

const findQuestionById = (id) => {
  if (!id || !props.surveyQuestions) return null;
  return props.surveyQuestions.find((q) => String(q.id) === String(id));
};

const getAnswerById = (questionId) => {
  if (!answers.value || !answers.value.question_answers) return undefined;
  const constAnswer = answers.value.question_answers.find(
    (qa) => String(qa.questionId) === String(questionId)
  );
  return constAnswer;
};

const getNextQuestionId = (currentQ, selectedOption = null) => {
  if (!currentQ) {
    return null;
  }

  if (selectedOption && selectedOption.next) {
    return selectedOption.next;
  }

  if (currentQ.conditionalNext) {
    const conditionalNextBlocks = Array.isArray(currentQ.conditionalNext)
      ? currentQ.conditionalNext
      : [currentQ.conditionalNext];

    for (const block of conditionalNextBlocks) {
      const conditionQuestionId = block.condition;
      const conditionAnswer = getAnswerById(conditionQuestionId);

      if (conditionAnswer !== undefined && conditionAnswer !== null) {
        for (const route of block.routes) {
          let primaryConditionMet = false;
          if (conditionAnswer.optionId === route.value || 
              (Array.isArray(conditionAnswer.optionId) && conditionAnswer.optionId.includes(route.value)) ||
              conditionAnswer.answer === route.value 
             ) {
            primaryConditionMet = true;
          }
          
          if (primaryConditionMet) {
            if (route.condition2) {
              const condition2QuestionId = route.condition2;
              const condition2Answer = getAnswerById(condition2QuestionId);
              if (condition2Answer !== undefined && condition2Answer !== null) {
                for (const route2 of route.routes2) {
                  if (condition2Answer.optionId === route2.value ||
                      (Array.isArray(condition2Answer.optionId) && condition2Answer.optionId.includes(route2.value)) ||
                      condition2Answer.answer === route2.value
                     ) {
                    if (route2.next === null) continue;
                    return route2.next;
                  }
                }
              }
              continue;
            }
            if (route.next === null) continue;
            return route.next;
          }
        }
      }
    }
  }

  if (currentQ.next) {
    return currentQ.next;
  }

  const currentIndex = props.surveyQuestions.findIndex(q => q.id === currentQ.id);
  if (currentIndex === props.surveyQuestions.length - 1 && !currentQ.next && !currentQ.conditionalNext) {
      return 'end';
  }
  
  return null;
};

// NEW: Function to evaluate condition strings like "VELO == 1 AND (S2 == 3 OR S3 == 3)"
const evaluateCondition = (conditionString) => {
  try {
    // Replace question IDs with their actual values
    let processedCondition = conditionString;
    
    // Find all question references in the condition (e.g., VELO, S2, S3)
    // Exclude logical operators AND, OR, NOT
    const questionRefs = conditionString.match(/\b(?!AND|OR|NOT)[A-Z][A-Z0-9_]*\b/g) || [];
    
    for (const questionRef of questionRefs) {
      const answer = getAnswerById(questionRef);
      let value = -1; // Default to -1 for unanswered questions
      
      if (answer) {
        // Use the option ID (numeric value) for comparisons
        if (typeof answer.optionId === 'number') {
          value = answer.optionId;
        } else if (Array.isArray(answer.optionId)) {
          // For multiple choice, we'll need special handling
          value = answer.optionId;
        } else {
          // For free text answers, use the actual text
          value = `'${answer.answer}'`;
        }
      }
      
      // Replace the question reference with the actual value
      processedCondition = processedCondition.replace(new RegExp(`\\b${questionRef}\\b`, 'g'), value);
    }
    
    // Replace logical operators to JavaScript equivalents
    processedCondition = processedCondition
      .replace(/\bAND\b/g, '&&')
      .replace(/\bOR\b/g, '||')
      .replace(/\bNOT\b/g, '!');
    
    // Evaluate the condition
    const result = Function(`"use strict"; return (${processedCondition})`)();
    return result;
  } catch (error) {
    console.error('Error evaluating condition:', conditionString, error);
    return true; // Default to showing the question if there's an error
  }
};

</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  /* Prevent iOS bounce scrolling and improve mobile behavior */
  -webkit-overflow-scrolling: touch;
  overflow-x: hidden;
  background-color: #2a3b63; /* Ensure body background matches */
}

html, body {
  /* Ensure proper height handling on mobile */
  height: 100%;
  position: relative;
  background-color: #2a3b63; /* Ensure body has the same background */
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* Use viewport height instead of 100% */
  min-height: -webkit-fill-available; /* For mobile Safari */
  width: 100%;
  background-color: #2a3b63;
  color: white;
  padding: 0;
  /* Prevent scrolling issues on mobile */
  position: relative;
  overflow-x: hidden;
}

.content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 20px 0 20px; /* Remove bottom padding that creates the line */
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  box-sizing: border-box;
  /* Prevent content jumping */
  position: relative;
  background-color: #2a3b63; /* Ensure content container also has background */
}

/* Add a fallback for very short content */
.content-container::after {
  content: '';
  flex: 1;
  background-color: #2a3b63;
}

.question-container {
  width: 100%;
  margin-bottom: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Prevent layout shifts */
  position: relative;
}

.question-container > h2 {
  margin-bottom: 20px;
  text-align: center;
}

/* Style for the direct div children of question-container (question type wrappers) */
.question-container > div {
  width: 100%;
  max-width: 400px; /* Consistent max-width */
  display: flex;
  flex-direction: column;
  align-items: center; /* Center their own children */
  margin-bottom: 20px; /* Spacing before next element (e.g., Retour button or end of container) */
}

/* Style for divs nested one level deeper within question-type wrappers (e.g., for v-for loops) */
.question-container > div > div {
  width: 100%; /* Ensure these take full width of their 400px parent */
  display: flex;
  flex-direction: column;
  align-items: center; /* Center their children if needed */
}

.input-container { 
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  position: relative;
}

.form-control {
  width: 100%; 
  max-width: 400px; 
  padding: 10px;
  border-radius: 5px;
  border: 1px solid white;
  background-color: #333; 
  color: white;
  font-size: 16px;
  margin-bottom: 15px;
  text-align: center; /* Center align text and placeholder */
  /* Prevent zoom on iOS */
  font-size: 16px;
  -webkit-appearance: none;
  -webkit-border-radius: 5px;
}

/* Prevent iOS zoom on input focus */
@media screen and (max-width: 768px) {
  .form-control {
    font-size: 16px !important;
    transform: translateZ(0);
  }
  
  /* Improve touch targets on mobile */
  .btn-next,
  .btn-return,
  .btn-option,
  .checkbox-label {
    min-height: 44px; /* iOS recommended touch target size */
  }
}

.btn-next,
.btn-return,
.btn-option,
.btn-pdf { 
  width: 100%; 
  max-width: 400px; 
  color: white;
  padding: 15px;
  margin-top: 15px; /* Standardized top margin */
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  text-align: center; /* Ensure text is centered */
  /* Improve mobile touch */
  -webkit-tap-highlight-color: rgba(0,0,0,0.1);
  touch-action: manipulation;
}

.btn-next {
  background-color: green;
  /* margin-top: 20px; */ /* Removed to use standardized 15px */
}

.btn-return {
  background-color: grey;
  /* margin-top: 30px; */ /* Removed to use standardized 15px */
}

.btn-option {
  background-color: #4a5a83; 
  /* text-align: left; */ /* Removed to allow text-align: center from group */
}

.checkbox-option {
  width: 100%;
  max-width: 400px; 
  margin-bottom: 12px; /* Add margin between options */
  display: flex;
  justify-content: center; /* Center the option */
}

.checkbox-label {
  display: flex;
  align-items: center;
  justify-content: flex-start; /* Align content to start within the label */
  color: white;
  font-size: 16px;
  cursor: pointer;
  padding: 12px 20px; /* Reduced padding, more horizontal space */
  background-color: #4a5a83; 
  border-radius: 8px; /* Slightly more rounded */
  transition: all 0.2s ease; /* Smooth transition for all properties */
  width: 100%;
  min-height: 50px; /* Ensure consistent height */
  box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* Subtle shadow */
  /* Improve mobile touch */
  -webkit-tap-highlight-color: rgba(0,0,0,0.1);
  touch-action: manipulation;
}

.checkbox-label:hover {
  background-color: #5a6a93; 
  transform: translateY(-1px); /* Slight lift on hover */
  box-shadow: 0 4px 8px rgba(0,0,0,0.15); /* Enhanced shadow on hover */
}

.checkbox-input {
  margin-right: 15px; 
  width: 20px; /* Slightly larger checkbox */
  height: 20px;
  cursor: pointer;
  flex-shrink: 0; /* Prevent checkbox from shrinking */
}

/* Ensure the multiple choice container is properly centered */
.question-container > div[v-else-if*="multipleChoice"] {
  width: 100%;
  max-width: 450px; /* Slightly wider for better proportion */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0; /* Remove gap, use margin on individual items instead */
  margin-bottom: 25px; /* More space before the next button */
}

/* Style the button container for multiple choice */
.question-container > div[v-else-if*="multipleChoice"] > button {
  margin-top: 20px; /* More space above the button */
  max-width: 400px; /* Match the options width */
}

.btn-pdf { 
  background-color: #3498db; 
  display: block;
}


.logo {
  max-width: 25%; 
  height: auto;
  margin-top: 40px; 
  margin-bottom: 0; /* Remove the margin that was creating the line */
}

.progress-bar {
  width: 100%;
  height: 10px;
  background-color: #e0e0e0;
  position: relative;
  overflow: hidden;
  margin-bottom: 20px;
}

.progress {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s ease-in-out;
}

/* Survey Tabs Styles */
.survey-tabs-container {
  width: 100%;
  background-color: #1e2b47;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 2px solid #4a5a83;
}

.survey-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.survey-tab-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.survey-tab {
  padding: 10px 16px;
  background-color: #4a5a83;
  color: white;
  border: 2px solid transparent;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  -webkit-tap-highlight-color: rgba(0,0,0,0.1);
  touch-action: manipulation;
}

.survey-info-btn {
  padding: 6px 10px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  -webkit-tap-highlight-color: rgba(0,0,0,0.1);
  touch-action: manipulation;
}

.survey-info-btn:hover {
  background-color: #2980b9;
  transform: scale(1.1);
}

.survey-tab:hover {
  background-color: #5a6a93;
}

.survey-tab.active {
  background-color: #2a3b63;
  border-bottom: 2px solid #4caf50;
  font-weight: 600;
}

.survey-tab.completed {
  background-color: #2e7d32;
  opacity: 0.8;
}

.survey-tab.completed.active {
  background-color: #1b5e20;
  opacity: 1;
}

.completed-badge {
  background-color: white;
  color: #2e7d32;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.btn-new-vehicle {
  padding: 10px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s ease;
  align-self: flex-start;
  -webkit-tap-highlight-color: rgba(0,0,0,0.1);
  touch-action: manipulation;
}

.btn-new-vehicle:hover {
  background-color: #45a049;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.btn-new-vehicle:active {
  transform: translateY(0);
}

.survey-complete-actions {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
  align-items: center;
}

@media screen and (max-width: 768px) {
  .survey-tabs-container {
    padding: 8px;
  }

  .survey-tab {
    padding: 8px 12px;
    font-size: 13px;
  }

  .btn-new-vehicle {
    width: 100%;
    padding: 12px;
  }
}

@media screen and (max-width: 480px) {
  .form-control, .btn-next, .btn-return, .btn-option, .checkbox-option {
    max-width: 90%; 
  }
  
  /* Reduce padding on mobile for better space usage */
  .content-container {
    padding: 15px;
  }
  
  /* Ensure proper spacing on small screens */
  .question-container {
    margin-bottom: 20px;
  }
  
  /* Mobile-specific height fixes */
  .app-container {
    min-height: 100vh;
    min-height: -webkit-fill-available;
    height: 100%;
  }
  
  /* Ensure body fills viewport on mobile */
  body {
    height: 100vh;
    height: -webkit-fill-available;
  }
  
  html {
    height: 100vh;
    height: -webkit-fill-available;
  }
}

.modal {
  position: fixed; 
  z-index: 9999; 
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.7); 
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  width: 90%; 
  height: 90%; 
  max-width: 1000px; 
  max-height: 80vh; 
  position: relative;
  background-color: #fff; 
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  overflow: auto; 
}

.pdf-content iframe {
  border: none;
  width: 100%;
  height: calc(100% - 40px); 
  background: #f0f0f0; 
}

.close { 
  position: absolute; 
  right: 10px;
  top: 10px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eee;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  color: #333;
  z-index: 10000; 
}

.close:hover {
  background: #ddd;
}

@media screen and (min-width: 768px) {
  .modal-content {
    padding: 30px;
  }
}

/* Survey Info Modal Styles */
.survey-info-modal {
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  background-color: #2a3b63;
  color: white;
}

.survey-info-modal h2 {
  margin-top: 0;
  margin-bottom: 20px;
  color: white;
  text-align: center;
}

.survey-info-modal h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #4caf50;
  font-size: 16px;
}

.survey-info-section {
  margin-bottom: 25px;
  padding: 15px;
  background-color: #1e2b47;
  border-radius: 8px;
}

.survey-info-section p {
  margin: 8px 0;
  color: white;
}

.survey-name-display {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.survey-name-display span {
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.survey-name-edit {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.btn-edit, .btn-save, .btn-cancel, .btn-delete {
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-edit {
  background-color: #3498db;
  color: white;
}

.btn-edit:hover {
  background-color: #2980b9;
}

.btn-save {
  background-color: #4caf50;
  color: white;
}

.btn-save:hover {
  background-color: #45a049;
}

.btn-cancel {
  background-color: #95a5a6;
  color: white;
}

.btn-cancel:hover {
  background-color: #7f8c8d;
}

.btn-delete {
  background-color: #e74c3c;
  color: white;
}

.btn-delete:hover {
  background-color: #c0392b;
}

.survey-answers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px;
  background-color: #4a5a83;
  border-radius: 5px;
}

.answer-item strong {
  color: #4caf50;
  font-size: 14px;
}

.answer-item span {
  color: white;
  font-size: 15px;
}

.survey-info-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 20px;
}

@media screen and (max-width: 768px) {
  .survey-info-modal {
    width: 95%;
    max-height: 90vh;
  }

  .survey-name-display,
  .survey-name-edit,
  .survey-info-actions {
    flex-direction: column;
    width: 100%;
  }

  .survey-name-edit input,
  .survey-name-edit button {
    width: 100%;
  }
}

.autocomplete-results {
  list-style-type: none;
  padding: 0;
  margin: 0;
  border: 1px solid #ccc;
  max-height: 150px;
  overflow-y: auto;
  position: absolute; 
  width: 100%; 
  background-color: #fff; 
  color: #333; 
  z-index: 1000; 
  border-radius: 0 0 5px 5px; 
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  top: 100%;
  left: 0;
}

.autocomplete-results li {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #eee; 
}

.autocomplete-results li:last-child {
  border-bottom: none;
}

.autocomplete-results li:hover {
  background-color: #f0f0f0; 
}

.start-survey-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  /* Prevent content jumping when transitioning */
  min-height: 200px;
  justify-content: center;
}

.start-survey-container h2 {
  margin-bottom: 20px;
}

.start-survey-container .btn-next {
  margin-top: 10px;
}

.survey-complete {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  margin-top: 20px; /* Add some space at the top */
  /* Prevent content jumping */
  min-height: 200px;
  justify-content: center;
}

.survey-complete h2 {
  margin-bottom: 20px;
}

/* Question Image Styles */
.question-image-container {
  margin: 20px 0;
  text-align: center;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  position: relative;
}

.question-image {
  max-width: 100%;
  max-height: 60vh;
  height: auto;
  width: auto;
  object-fit: contain;
  display: block;
  margin: 0 auto;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s ease;
  /* Optimize for tablet performance */
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.question-image:hover {
  transform: scale(1.02);
}

.zoom-hint {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

/* Image Zoom Modal Styles */
.image-zoom-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.95);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.image-zoom-container {
  position: relative;
  width: 95%;
  height: 95%;
  max-width: 1200px;
  max-height: 900px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.close-zoom {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10001;
  transition: all 0.2s ease;
  color: #333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.close-zoom:hover {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.1);
}



.zoom-image-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 0 0 16px 16px;
}

.zoom-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transform-origin: center;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* Samsung Tablet optimizations */
@media screen and (min-width: 768px) and (max-width: 1024px) {
  .question-image {
    max-height: 50vh;
  }
  
  .question-image-container {
    margin: 15px 0;
  }
  
  .close-zoom {
    width: 52px;
    height: 52px;
  }
  
  .zoom-hint {
    font-size: 14px;
    padding: 6px 12px;
    bottom: 12px;
    right: 12px;
  }
  
  .image-zoom-container {
    width: 98%;
    height: 98%;
  }
}

/* Mobile optimizations */
@media screen and (max-width: 767px) {
  .question-image {
    max-height: 40vh;
  }
  
  .question-image-container {
    margin: 10px 0;
    border-radius: 5px;
  }
  
  .close-zoom {
    top: 12px;
    right: 12px;
    width: 40px;
    height: 40px;
  }
  
  .zoom-hint {
    font-size: 11px;
    padding: 3px 6px;
    bottom: 6px;
    right: 6px;
  }
}

/* Touch-specific styles for better Samsung tablet experience */
@media (pointer: coarse) {
  .question-image {
    cursor: pointer;
  }
  
  .zoom-image {
    cursor: grab;
  }
  
  .zoom-image:active {
    cursor: grabbing;
  }
  
  /* Larger touch targets for tablet */
  .close-zoom {
    min-width: 48px;
    min-height: 48px;
  }
  
  /* Disable text selection on touch devices */
  .image-zoom-modal * {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
  
  /* Improve scroll behavior */
  .zoom-image-wrapper {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
}

</style>