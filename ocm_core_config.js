/**
 * OCM System Core Configuration
 * 전역 설정 및 상수 관리
 */

// ========================================
// 시스템 기본 설정
// ========================================
export const OCM_CONFIG = {
  version: '2.0.0',
  name: 'Oasis Client Manager',
  description: '오아시스 클라이언트 관리 시스템',
  
  // API 설정
  api: {
    baseUrl: process.env.API_BASE_URL || '',
    timeout: 30000,
    retries: 3
  },
  
  // 스토리지 설정
  storage: {
    prefix: 'ocm_v2_',
    compression: true,
    encryption: false,
    autoBackup: true,
    backupInterval: 86400000 // 24시간
  },
  
  // UI 설정
  ui: {
    theme: 'default',
    animations: true,
    pageSize: 10,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedFileTypes: ['.pdf', '.doc', '.docx', '.jpg', '.png']
  },
  
  // 문서 설정
  documents: {
    autoNumbering: true,
    numberFormat: 'YYMMDD_##',
    pdfSettings: {
      format: 'A4',
      margin: '20mm',
      encoding: 'UTF-8'
    }
  },
  
  // 통합 서비스 설정
  integrations: {
    google: {
      calendar: true,
      drive: true,
      gmail: false
    },
    email: {
      provider: 'smtp',
      autoSend: false
    }
  }
};

// ========================================
// 시스템 상수
// ========================================
export const OCM_CONSTANTS = {
  // 스토리지 키
  STORAGE_KEYS: {
    CLIENTS: 'clients',
    PROJECTS: 'projects',
    QUOTES: 'quotes',
    CONTRACTS: 'contracts',
    TRANSACTIONS: 'transactions',
    SETTLEMENTS: 'settlements',
    WORK_ORDERS: 'work_orders',
    DELIVERIES: 'deliveries',
    CALENDAR: 'calendar',
    SETTINGS: 'settings',
    AUTH: 'auth',
    EMAIL_LOGS: 'email_logs',
    DRIVE_LINKS: 'drive_links',
    TEMPLATES: 'templates'
  },
  
  // 프로젝트 상태
  PROJECT_STATUS: {
    RECEIVED: 'received',
    QUOTED: 'quoted',
    CONTRACTED: 'contracted',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ON_HOLD: 'on_hold'
  },
  
  // 상태별 표시 텍스트
  STATUS_TEXT: {
    received: '접수됨',
    quoted: '견적발송',
    contracted: '계약체결',
    in_progress: '진행중',
    completed: '완료',
    cancelled: '취소됨',
    on_hold: '보류'
  },
  
  // 상태별 색상 클래스
  STATUS_COLORS: {
    received: 'bg-blue-100 text-blue-800 border-blue-200',
    quoted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    contracted: 'bg-green-100 text-green-800 border-green-200',
    in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
    completed: 'bg-gray-100 text-gray-800 border-gray-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
    on_hold: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  
  // 예산 범위
  BUDGET_RANGES: [
    { value: 'under_1m', label: '100만원 이하', min: 0, max: 1000000 },
    { value: '1m_5m', label: '100만원 - 500만원', min: 1000000, max: 5000000 },
    { value: '5m_10m', label: '500만원 - 1000만원', min: 5000000, max: 10000000 },
    { value: '10m_50m', label: '1000만원 - 5000만원', min: 10000000, max: 50000000 },
    { value: '50m_100m', label: '5000만원 - 1억원', min: 50000000, max: 100000000 },
    { value: 'over_100m', label: '1억원 이상', min: 100000000, max: Infinity }
  ],
  
  // 프로젝트 타입
  PROJECT_TYPES: [
    { value: 'product_design', label: '제품 설계', icon: '🎨' },
    { value: 'prototype', label: '시제품 제작', icon: '🔧' },
    { value: 'consulting', label: '컨설팅', icon: '💡' },
    { value: 'web_development', label: '웹개발', icon: '💻' },
    { value: 'mobile_app', label: '모바일앱', icon: '📱' },
    { value: 'iot_solution', label: 'IoT 솔루션', icon: '🌐' },
    { value: 'maintenance', label: '유지보수', icon: '🔨' },
    { value: 'training', label: '교육/연수', icon: '📚' },
    { value: 'other', label: '기타', icon: '📦' }
  ],
  
  // 결제 상태
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PARTIAL: 'partial',
    COMPLETED: 'completed',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled'
  },
  
  // 결제 상태 텍스트
  PAYMENT_STATUS_TEXT: {
    pending: '미납',
    partial: '부분납',
    completed: '완납',
    overdue: '연체',
    cancelled: '취소'
  },
  
  // 문서 타입
  DOCUMENT_TYPES: {
    QUOTE: 'quote',
    CONTRACT: 'contract',
    TRANSACTION: 'transaction',
    WORK_ORDER: 'work_order',
    DELIVERY: 'delivery',
    SETTLEMENT: 'settlement',
    RECEIPT: 'receipt',
    INVOICE: 'invoice'
  },
  
  // 문서 타입별 표시 텍스트
  DOCUMENT_TYPE_TEXT: {
    quote: '견적서',
    contract: '계약서',
    transaction: '거래명세서',
    work_order: '과업지시서',
    delivery: '배송내역서',
    settlement: '정산내역서',
    receipt: '영수증',
    invoice: '세금계산서'
  },
  
  // 우선순위
  PRIORITY_LEVELS: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  },
  
  // 우선순위 텍스트
  PRIORITY_TEXT: {
    low: '낮음',
    medium: '보통',
    high: '높음',
    urgent: '긴급'
  },
  
  // 우선순위 색상
  PRIORITY_COLORS: {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-yellow-100 text-yellow-800',
    urgent: 'bg-red-100 text-red-800'
  },
  
  // 탭 정보
  TAB_INFO: {
    dashboard: { 
      label: '대시보드', 
      icon: '🏠', 
      description: '프로젝트 현황 개요',
      color: 'blue'
    },
    clients: { 
      label: '클라이언트', 
      icon: '👥', 
      description: '고객 정보 관리',
      color: 'green'
    },
    projects: { 
      label: '프로젝트', 
      icon: '📋', 
      description: '프로젝트 관리',
      color: 'purple'
    },
    quotes: { 
      label: '견적서', 
      icon: '💰', 
      description: '견적서 작성 및 관리',
      color: 'yellow'
    },
    contracts: { 
      label: '계약서', 
      icon: '📄', 
      description: '계약서 관리',
      color: 'indigo'
    },
    transactions: { 
      label: '거래명세서', 
      icon: '📊', 
      description: '거래명세서 관리',
      color: 'pink'
    },
    settlements: { 
      label: '정산관리', 
      icon: '💳', 
      description: '결제 및 정산 관리',
      color: 'red'
    },
    integrations: { 
      label: '연동설정', 
      icon: '🔗', 
      description: 'Google 서비스 연동',
      color: 'gray'
    }
  },
  
  // 날짜 형식
  DATE_FORMATS: {
    DISPLAY: 'YYYY-MM-DD',
    INPUT: 'YYYY-MM-DD',
    TIMESTAMP: 'YYYY-MM-DD HH:mm:ss',
    FILE_NAME: 'YYMMDD'
  },
  
  // 통화 형식
  CURRENCY: {
    CODE: 'KRW',
    SYMBOL: '₩',
    DECIMAL_PLACES: 0
  },
  
  // 에러 코드
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    PERMISSION_ERROR: 'PERMISSION_ERROR',
    SYSTEM_ERROR: 'SYSTEM_ERROR'
  },
  
  // 성공 메시지
  SUCCESS_MESSAGES: {
    CREATED: '성공적으로 생성되었습니다.',
    UPDATED: '성공적으로 수정되었습니다.',
    DELETED: '성공적으로 삭제되었습니다.',
    SAVED: '성공적으로 저장되었습니다.',
    EXPORTED: '성공적으로 내보내기가 완료되었습니다.',
    IMPORTED: '성공적으로 가져오기가 완료되었습니다.'
  },
  
  // 확인 메시지
  CONFIRM_MESSAGES: {
    DELETE: '정말로 삭제하시겠습니까?',
    CANCEL: '작업을 취소하시겠습니까?',
    OVERWRITE: '기존 데이터를 덮어쓰시겠습니까?',
    RESET: '모든 데이터를 초기화하시겠습니까?'
  }
};

// ========================================
// 타입 정의 (JSDoc)
// ========================================

/**
 * @typedef {Object} Client
 * @property {string} id - 클라이언트 고유 ID
 * @property {string} companyName - 회사명
 * @property {string} contactPerson - 담당자명
 * @property {string} email - 이메일 주소
 * @property {string} phone - 전화번호
 * @property {string} [website] - 웹사이트
 * @property {string} [address] - 주소
 * @property {'corporate'|'individual'} clientType - 고객 유형
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 * @property {string} [notes] - 메모
 */

/**
 * @typedef {Object} Project
 * @property {string} id - 프로젝트 고유 ID
 * @property {string} projectNumber - 프로젝트 번호
 * @property {string} clientId - 클라이언트 ID
 * @property {string} projectTitle - 프로젝트 제목
 * @property {string} projectDescription - 프로젝트 설명
 * @property {string} projectType - 프로젝트 타입
 * @property {string} budgetRange - 예산 범위
 * @property {string} status - 프로젝트 상태
 * @property {string} priority - 우선순위
 * @property {Date} startDate - 시작일
 * @property {Date} endDate - 종료일
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 * @property {string} [assignee] - 담당자
 * @property {string} [notes] - 메모
 */

/**
 * @typedef {Object} Quote
 * @property {string} id - 견적서 고유 ID
 * @property {string} quoteNumber - 견적서 번호
 * @property {string} projectId - 프로젝트 ID
 * @property {string} clientId - 클라이언트 ID
 * @property {QuoteItem[]} items - 견적 항목들
 * @property {number} subtotal - 소계
 * @property {number} taxRate - 세율
 * @property {number} taxAmount - 세액
 * @property {number} total - 총액
 * @property {Date} issueDate - 발행일
 * @property {Date} validUntil - 유효기간
 * @property {string} status - 견적서 상태
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 * @property {string} [notes] - 메모
 */

/**
 * @typedef {Object} QuoteItem
 * @property {string} id - 항목 고유 ID
 * @property {string} description - 항목 설명
 * @property {number} quantity - 수량
 * @property {string} unit - 단위
 * @property {number} unitPrice - 단가
 * @property {number} amount - 금액
 */

/**
 * @typedef {Object} Contract
 * @property {string} id - 계약서 고유 ID
 * @property {string} contractNumber - 계약서 번호
 * @property {string} projectId - 프로젝트 ID
 * @property {string} clientId - 클라이언트 ID
 * @property {string} quoteId - 견적서 ID
 * @property {number} contractAmount - 계약 금액
 * @property {PaymentSchedule[]} paymentSchedule - 결제 일정
 * @property {Date} startDate - 계약 시작일
 * @property {Date} endDate - 계약 종료일
 * @property {Date} signedDate - 서명일
 * @property {string} status - 계약 상태
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 * @property {string} [terms] - 계약 조건
 * @property {string} [notes] - 메모
 */

/**
 * @typedef {Object} PaymentSchedule
 * @property {string} id - 결제 일정 고유 ID
 * @property {string} phase - 결제 단계 (선금, 중도금, 잔금)
 * @property {number} amount - 결제 금액
 * @property {Date} dueDate - 결제 예정일
 * @property {Date} [paidDate] - 실제 결제일
 * @property {string} status - 결제 상태
 * @property {string} [method] - 결제 방법
 * @property {string} [notes] - 메모
 */

/**
 * @typedef {Object} Document
 * @property {string} id - 문서 고유 ID
 * @property {string} documentNumber - 문서 번호
 * @property {string} documentType - 문서 타입
 * @property {string} projectId - 프로젝트 ID
 * @property {string} clientId - 클라이언트 ID
 * @property {string} title - 문서 제목
 * @property {Object} data - 문서 데이터
 * @property {string} status - 문서 상태
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 * @property {string} [filePath] - 파일 경로
 * @property {string} [notes] - 메모
 */

// ========================================
// 유틸리티 함수
// ========================================

/**
 * 설정 값을 가져오는 함수
 * @param {string} path - 설정 경로 (예: 'ui.theme')
 * @param {*} defaultValue - 기본값
 * @returns {*} 설정 값
 */
export function getConfig(path, defaultValue = null) {
  const keys = path.split('.');
  let current = OCM_CONFIG;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  
  return current;
}

/**
 * 상수 값을 가져오는 함수
 * @param {string} path - 상수 경로 (예: 'PROJECT_STATUS.RECEIVED')
 * @param {*} defaultValue - 기본값
 * @returns {*} 상수 값
 */
export function getConstant(path, defaultValue = null) {
  const keys = path.split('.');
  let current = OCM_CONSTANTS;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  
  return current;
}

/**
 * 환경 변수를 확인하고 설정을 업데이트하는 함수
 */
export function initializeConfig() {
  // 개발 모드 확인
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    OCM_CONFIG.development = true;
    OCM_CONFIG.debug = true;
  }
  
  // 로컬 스토리지에서 사용자 설정 로드
  try {
    const userSettings = localStorage.getItem(`${OCM_CONFIG.storage.prefix}user_settings`);
    if (userSettings) {
      const settings = JSON.parse(userSettings);
      // 사용자 설정으로 기본 설정 오버라이드
      Object.assign(OCM_CONFIG.ui, settings.ui || {});
    }
  } catch (error) {
    console.warn('사용자 설정 로드 실패:', error);
  }
}

/**
 * 디버그 모드 확인
 * @returns {boolean} 디버그 모드 여부
 */
export function isDebugMode() {
  return getConfig('debug', false) || getConfig('development', false);
}

/**
 * 기능이 활성화되어 있는지 확인
 * @param {string} feature - 기능 이름
 * @returns {boolean} 활성화 여부
 */
export function isFeatureEnabled(feature) {
  return getConfig(`features.${feature}`, false);
}

// ========================================
// 전역 객체에 노출
// ========================================
if (typeof window !== 'undefined') {
  window.OCM_CONFIG = OCM_CONFIG;
  window.OCM_CONSTANTS = OCM_CONSTANTS;
  window.OCM_CORE = {
    getConfig,
    getConstant,
    initializeConfig,
    isDebugMode,
    isFeatureEnabled
  };
}