/**
 * OCM System Base Storage
 * 통합 데이터 스토리지 관리 시스템
 */

// ========================================
// 기본 스토리지 클래스
// ========================================

/**
 * 기본 스토리지 추상 클래스
 */
export class BaseStorage {
  constructor(storageKey, options = {}) {
    this.storageKey = storageKey;
    this.options = {
      autoSave: true,
      validation: true,
      compression: false,
      encryption: false,
      ...options
    };
    
    this.data = this._loadData();
    this.listeners = new Set();
    this._setupAutoSave();
  }

  /**
   * 모든 데이터 조회
   * @returns {Array} 전체 데이터 배열
   */
  getAll() {
    try {
      return [...this.data];
    } catch (error) {
      console.error(`[${this.storageKey}] 데이터 조회 오류:`, error);
      return [];
    }
  }

  /**
   * ID로 데이터 조회
   * @param {string} id - 조회할 데이터 ID
   * @returns {Object|null} 조회된 데이터 또는 null
   */
  getById(id) {
    try {
      return this.data.find(item => item.id === id) || null;
    } catch (error) {
      console.error(`[${this.storageKey}] ID 조회 오류:`, error);
      return null;
    }
  }

  /**
   * 조건으로 데이터 조회
   * @param {Function} predicate - 조건 함수
   * @returns {Array} 조건에 맞는 데이터 배열
   */
  getWhere(predicate) {
    try {
      return this.data.filter(predicate);
    } catch (error) {
      console.error(`[${this.storageKey}] 조건 조회 오류:`, error);
      return [];
    }
  }

  /**
   * 데이터 생성
   * @param {Object} itemData - 생성할 데이터
   * @returns {Object} 생성된 데이터
   */
  create(itemData) {
    try {
      // 유효성 검사
      if (this.options.validation) {
        this._validateData(itemData);
      }

      // ID 생성
      const newItem = {
        ...itemData,
        id: itemData.id || this._generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 중복 ID 확인
      if (this.getById(newItem.id)) {
        throw new Error(`중복된 ID입니다: ${newItem.id}`);
      }

      // 데이터 추가
      this.data.push(newItem);
      this._save();
      this._notifyListeners('create', newItem);

      return newItem;
    } catch (error) {
      console.error(`[${this.storageKey}] 생성 오류:`, error);
      throw error;
    }
  }

  /**
   * 데이터 수정
   * @param {string} id - 수정할 데이터 ID
   * @param {Object} updates - 수정할 데이터
   * @returns {Object|null} 수정된 데이터
   */
  update(id, updates) {
    try {
      const index = this.data.findIndex(item => item.id === id);
      if (index === -1) {
        throw new Error(`데이터를 찾을 수 없습니다: ${id}`);
      }

      // 수정된 데이터 생성
      const updatedItem = {
        ...this.data[index],
        ...updates,
        id, // ID는 변경 불가
        updatedAt: new Date().toISOString()
      };

      // 유효성 검사
      if (this.options.validation) {
        this._validateData(updatedItem);
      }

      // 데이터 업데이트
      this.data[index] = updatedItem;
      this._save();
      this._notifyListeners('update', updatedItem);

      return updatedItem;
    } catch (error) {
      console.error(`[${this.storageKey}] 수정 오류:`, error);
      throw error;
    }
  }

  /**
   * 데이터 삭제
   * @param {string} id - 삭제할 데이터 ID
   * @returns {boolean} 삭제 성공 여부
   */
  delete(id) {
    try {
      const index = this.data.findIndex(item => item.id === id);
      if (index === -1) {
        return false;
      }

      const deletedItem = this.data[index];
      this.data.splice(index, 1);
      this._save();
      this._notifyListeners('delete', deletedItem);

      return true;
    } catch (error) {
      console.error(`[${this.storageKey}] 삭제 오류:`, error);
      return false;
    }
  }

  /**
   * 일괄 업데이트
   * @param {Array} items - 업데이트할 데이터 배열
   * @returns {boolean} 성공 여부
   */
  bulkUpdate(items) {
    try {
      const validatedItems = items.map(item => {
        if (this.options.validation) {
          this._validateData(item);
        }
        return {
          ...item,
          updatedAt: new Date().toISOString()
        };
      });

      this.data = validatedItems;
      this._save();
      this._notifyListeners('bulkUpdate', validatedItems);

      return true;
    } catch (error) {
      console.error(`[${this.storageKey}] 일괄 업데이트 오류:`, error);
      return false;
    }
  }

  /**
   * 데이터 개수 조회
   * @returns {number} 데이터 개수
   */
  count() {
    return this.data.length;
  }

  /**
   * 데이터 존재 여부 확인
   * @param {string} id - 확인할 데이터 ID
   * @returns {boolean} 존재 여부
   */
  exists(id) {
    return this.data.some(item => item.id === id);
  }

  /**
   * 데이터 초기화
   */
  clear() {
    try {
      this.data = [];
      this._save();
      this._notifyListeners('clear', []);
    } catch (error) {
      console.error(`[${this.storageKey}] 초기화 오류:`, error);
      throw error;
    }
  }

  /**
   * 변경 사항 리스너 등록
   * @param {Function} listener - 리스너 함수
   */
  subscribe(listener) {
    this.listeners.add(listener);
    
    // 구독 해제 함수 반환
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 데이터 내보내기
   * @returns {Object} 내보낼 데이터
   */
  export() {
    return {
      storageKey: this.storageKey,
      version: window.OCM_CONFIG?.version || '2.0.0',
      exportedAt: new Date().toISOString(),
      data: this.data
    };
  }

  /**
   * 데이터 가져오기
   * @param {Object} exportedData - 가져올 데이터
   * @param {boolean} merge - 기존 데이터와 병합 여부
   */
  import(exportedData, merge = false) {
    try {
      if (!exportedData || !Array.isArray(exportedData.data)) {
        throw new Error('잘못된 데이터 형식입니다.');
      }

      if (merge) {
        // 기존 데이터와 병합
        const existingIds = new Set(this.data.map(item => item.id));
        const newItems = exportedData.data.filter(item => !existingIds.has(item.id));
        this.data.push(...newItems);
      } else {
        // 전체 데이터 교체
        this.data = [...exportedData.data];
      }

      this._save();
      this._notifyListeners('import', this.data);
    } catch (error) {
      console.error(`[${this.storageKey}] 가져오기 오류:`, error);
      throw error;
    }
  }

  // ========================================
  // 내부 메서드
  // ========================================

  /**
   * 데이터 로드
   * @private
   */
  _loadData() {
    try {
      const prefix = window.OCM_CONFIG?.storage?.prefix || 'ocm_v2_';
      const key = `${prefix}${this.storageKey}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);
      
      // 압축 해제
      if (this.options.compression && parsed._compressed) {
        return this._decompress(parsed.data);
      }
      
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`[${this.storageKey}] 데이터 로드 오류:`, error);
      return [];
    }
  }

  /**
   * 데이터 저장
   * @private
   */
  _save() {
    try {
      const prefix = window.OCM_CONFIG?.storage?.prefix || 'ocm_v2_';
      const key = `${prefix}${this.storageKey}`;
      
      let dataToSave = this.data;
      
      // 압축
      if (this.options.compression) {
        dataToSave = {
          _compressed: true,
          data: this._compress(this.data)
        };
      }

      localStorage.setItem(key, JSON.stringify(dataToSave));
    } catch (error) {
      console.error(`[${this.storageKey}] 데이터 저장 오류:`, error);
      throw error;
    }
  }

  /**
   * ID 생성
   * @private
   */
  _generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 데이터 유효성 검사
   * @private
   */
  _validateData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('데이터는 객체여야 합니다.');
    }
    
    // 서브클래스에서 오버라이드 가능
    this.validate(data);
  }

  /**
   * 서브클래스에서 구현할 유효성 검사 메서드
   * @param {Object} data - 검사할 데이터
   */
  validate(data) {
    // 기본 구현은 빈 메서드
    // 서브클래스에서 필요에 따라 오버라이드
  }

  /**
   * 자동 저장 설정
   * @private
   */
  _setupAutoSave() {
    if (this.options.autoSave) {
      // 페이지 언로드 시 저장
      window.addEventListener('beforeunload', () => {
        this._save();
      });
    }
  }

  /**
   * 리스너들에게 변경 사항 알림
   * @private
   */
  _notifyListeners(action, data) {
    this.listeners.forEach(listener => {
      try {
        listener(action, data, this.storageKey);
      } catch (error) {
        console.error('리스너 실행 오류:', error);
      }
    });
  }

  /**
   * 데이터 압축 (간단한 구현)
   * @private
   */
  _compress(data) {
    // 실제 압축 알고리즘 구현 필요시 교체
    return JSON.stringify(data);
  }

  /**
   * 데이터 압축 해제
   * @private
   */
  _decompress(compressedData) {
    try {
      return JSON.parse(compressedData);
    } catch (error) {
      console.error('압축 해제 오류:', error);
      return [];
    }
  }
}

// ========================================
// 스토리지 매니저 클래스
// ========================================

/**
 * 중앙 스토리지 관리자
 */
export class StorageManager {
  constructor() {
    this.storages = new Map();
    this.globalListeners = new Set();
  }

  /**
   * 스토리지 등록
   * @param {string} name - 스토리지 이름
   * @param {BaseStorage} storage - 스토리지 인스턴스
   */
  register(name, storage) {
    this.storages.set(name, storage);
    
    // 전역 리스너에게 알림
    storage.subscribe((action, data, storageKey) => {
      this._notifyGlobalListeners(action, data, storageKey);
    });
  }

  /**
   * 스토리지 조회
   * @param {string} name - 스토리지 이름
   * @returns {BaseStorage|null} 스토리지 인스턴스
   */
  get(name) {
    return this.storages.get(name) || null;
  }

  /**
   * 전역 리스너 등록
   * @param {Function} listener - 리스너 함수
   */
  subscribe(listener) {
    this.globalListeners.add(listener);
    
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * 모든 데이터 내보내기
   * @returns {Object} 전체 시스템 데이터
   */
  exportAll() {
    const exports = {};
    
    this.storages.forEach((storage, name) => {
      exports[name] = storage.export();
    });

    return {
      version: window.OCM_CONFIG?.version || '2.0.0',
      exportedAt: new Date().toISOString(),
      storages: exports
    };
  }

  /**
   * 모든 데이터 가져오기
   * @param {Object} importData - 가져올 데이터
   * @param {boolean} merge - 병합 여부
   */
  importAll(importData, merge = false) {
    if (!importData.storages) {
      throw new Error('잘못된 데이터 형식입니다.');
    }

    Object.entries(importData.storages).forEach(([name, data]) => {
      const storage = this.get(name);
      if (storage) {
        storage.import(data, merge);
      }
    });
  }

  /**
   * 전체 데이터 초기화
   */
  clearAll() {
    this.storages.forEach(storage => {
      storage.clear();
    });
  }

  /**
   * 전역 리스너들에게 알림
   * @private
   */
  _notifyGlobalListeners(action, data, storageKey) {
    this.globalListeners.forEach(listener => {
      try {
        listener(action, data, storageKey);
      } catch (error) {
        console.error('전역 리스너 실행 오류:', error);
      }
    });
  }
}

// ========================================
// 전역 인스턴스 생성
// ========================================

// 스토리지 매니저 싱글톤
const storageManager = new StorageManager();

// 전역 객체에 노출
if (typeof window !== 'undefined') {
  window.OCM_STORAGE_MANAGER = storageManager;
  window.OCM_BASE_STORAGE = {
    BaseStorage,
    StorageManager,
    manager: storageManager
  };
}

export { storageManager as default };