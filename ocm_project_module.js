/**
 * OCM Project Management Module
 * 프로젝트 관리 통합 모듈
 */

import { BaseStorage } from '../data/base-storage.js';

// ========================================
// 프로젝트 스토리지 클래스
// ========================================

class ProjectStorage extends BaseStorage {
  constructor() {
    super('projects', {
      autoSave: true,
      validation: true
    });
  }

  /**
   * 프로젝트 데이터 유효성 검사
   * @param {Object} data - 검사할 프로젝트 데이터
   */
  validate(data) {
    const required = ['clientId', 'projectTitle', 'projectDescription', 'projectType'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`필수 필드가 누락되었습니다: ${missing.join(', ')}`);
    }

    // 날짜 유효성 검사
    if (data.startDate && data.endDate) {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      
      if (endDate <= startDate) {
        throw new Error('종료일은 시작일보다 나중이어야 합니다.');
      }
    }

    // 상태 유효성 검사
    const validStatuses = Object.values(window.OCM_CONSTANTS?.PROJECT_STATUS || {});
    if (data.status && !validStatuses.includes(data.status)) {
      throw new Error(`유효하지 않은 상태입니다: ${data.status}`);
    }
  }

  /**
   * 클라이언트별 프로젝트 조회
   * @param {string} clientId - 클라이언트 ID
   * @returns {Array} 프로젝트 목록
   */
  getByClient(clientId) {
    return this.getWhere(project => project.clientId === clientId);
  }

  /**
   * 상태별 프로젝트 조회
   * @param {string} status - 프로젝트 상태
   * @returns {Array} 프로젝트 목록
   */
  getByStatus(status) {
    return this.getWhere(project => project.status === status);
  }

  /**
   * 기간별 프로젝트 조회
   * @param {Date} startDate - 시작일
   * @param {Date} endDate - 종료일
   * @returns {Array} 프로젝트 목록
   */
  getByDateRange(startDate, endDate) {
    return this.getWhere(project => {
      const projectStart = new Date(project.startDate);
      return projectStart >= startDate && projectStart <= endDate;
    });
  }

  /**
   * 담당자별 프로젝트 조회
   * @param {string} assignee - 담당자
   * @returns {Array} 프로젝트 목록
   */
  getByAssignee(assignee) {
    return this.getWhere(project => project.assignee === assignee);
  }

  /**
   * 프로젝트 번호 생성
   * @param {Date} date - 기준 날짜
   * @returns {string} 프로젝트 번호
   */
  generateProjectNumber(date = new Date()) {
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // 해당 날짜의 기존 프로젝트 수 확인
    const datePrefix = `${year}${month}${day}`;
    const existingProjects = this.getWhere(project => 
      project.projectNumber && project.projectNumber.startsWith(datePrefix)
    );
    
    const sequence = String(existingProjects.length + 1).padStart(2, '0');
    return `${datePrefix}_${sequence}`;
  }

  /**
   * 활성 프로젝트 조회
   * @returns {Array} 활성 프로젝트 목록
   */
  getActiveProjects() {
    const activeStatuses = ['received', 'quoted', 'contracted', 'in_progress'];
    return this.getWhere(project => activeStatuses.includes(project.status));
  }

  /**
   * 완료된 프로젝트 조회
   * @returns {Array} 완료된 프로젝트 목록
   */
  getCompletedProjects() {
    return this.getWhere(project => project.status === 'completed');
  }

  /**
   * 지연된 프로젝트 조회
   * @returns {Array} 지연된 프로젝트 목록
   */
  getOverdueProjects() {
    const today = new Date();
    return this.getWhere(project => {
      if (!project.endDate || project.status === 'completed') return false;
      return new Date(project.endDate) < today;
    });
  }
}

// ========================================
// 프로젝트 서비스 클래스
// ========================================

class ProjectService {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * 프로젝트 생성
   * @param {Object} projectData - 프로젝트 데이터
   * @returns {Object} 생성된 프로젝트
   */
  async createProject(projectData) {
    try {
      // 클라이언트 존재 확인
      const clientStorage = window.OCM_STORAGE_MANAGER?.get('clients');
      if (clientStorage && !clientStorage.exists(projectData.clientId)) {
        throw new Error('존재하지 않는 클라이언트입니다.');
      }

      // 프로젝트 번호 생성
      const projectNumber = this.storage.generateProjectNumber();

      // 기본값 설정
      const newProject = {
        ...projectData,
        projectNumber,
        status: projectData.status || 'received',
        priority: projectData.priority || 'medium',
        progress: 0
      };

      const created = this.storage.create(newProject);
      
      // 관련 이벤트 발생
      this._dispatchEvent('project:created', created);
      
      return created;
    } catch (error) {
      console.error('프로젝트 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 프로젝트 업데이트
   * @param {string} id - 프로젝트 ID
   * @param {Object} updates - 업데이트할 데이터
   * @returns {Object} 업데이트된 프로젝트
   */
  async updateProject(id, updates) {
    try {
      const project = this.storage.getById(id);
      if (!project) {
        throw new Error('프로젝트를 찾을 수 없습니다.');
      }

      // 상태 변경 시 로직
      if (updates.status && updates.status !== project.status) {
        updates = await this._handleStatusChange(project, updates);
      }

      const updated = this.storage.update(id, updates);
      
      this._dispatchEvent('project:updated', updated);
      return updated;
    } catch (error) {
      console.error('프로젝트 업데이트 오류:', error);
      throw error;
    }
  }

  /**
   * 프로젝트 삭제
   * @param {string} id - 프로젝트 ID
   * @returns {boolean} 삭제 성공 여부
   */
  async deleteProject(id) {
    try {
      // 관련 문서 확인
      const hasDocuments = this._hasRelatedDocuments(id);
      if (hasDocuments) {
        throw new Error('관련 문서가 있어 삭제할 수 없습니다.');
      }

      const project = this.storage.getById(id);
      const success = this.storage.delete(id);

      if (success) {
        this._dispatchEvent('project:deleted', { id, project });
      }

      return success;
    } catch (error) {
      console.error('프로젝트 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * 프로젝트 검색
   * @param {Object} searchParams - 검색 조건
   * @returns {Array} 검색 결과
   */
  searchProjects(searchParams) {
    const {
      query,
      status,
      clientId,
      assignee,
      projectType,
      priority,
      dateFrom,
      dateTo
    } = searchParams;

    let results = this.storage.getAll();

    // 텍스트 검색
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(project =>
        project.projectTitle.toLowerCase().includes(lowerQuery) ||
        project.projectDescription.toLowerCase().includes(lowerQuery) ||
        project.projectNumber.toLowerCase().includes(lowerQuery)
      );
    }

    // 상태 필터
    if (status) {
      results = results.filter(project => project.status === status);
    }

    // 클라이언트 필터
    if (clientId) {
      results = results.filter(project => project.clientId === clientId);
    }

    // 담당자 필터
    if (assignee) {
      results = results.filter(project => project.assignee === assignee);
    }

    // 프로젝트 타입 필터
    if (projectType) {
      results = results.filter(project => project.projectType === projectType);
    }

    // 우선순위 필터
    if (priority) {
      results = results.filter(project => project.priority === priority);
    }

    // 날짜 범위 필터
    if (dateFrom || dateTo) {
      results = results.filter(project => {
        const projectDate = new Date(project.startDate || project.createdAt);
        if (dateFrom && projectDate < new Date(dateFrom)) return false;
        if (dateTo && projectDate > new Date(dateTo)) return false;
        return true;
      });
    }

    return results;
  }

  /**
   * 프로젝트 통계 정보
   * @returns {Object} 통계 정보
   */
  getProjectStats() {
    const projects = this.storage.getAll();
    const activeProjects = this.storage.getActiveProjects();
    const completedProjects = this.storage.getCompletedProjects();
    const overdueProjects = this.storage.getOverdueProjects();

    // 상태별 통계
    const statusStats = {};
    const statuses = Object.values(window.OCM_CONSTANTS?.PROJECT_STATUS || {});
    statuses.forEach(status => {
      statusStats[status] = projects.filter(p => p.status === status).length;
    });

    // 타입별 통계
    const typeStats = {};
    const types = window.OCM_CONSTANTS?.PROJECT_TYPES || [];
    types.forEach(type => {
      typeStats[type.value] = projects.filter(p => p.projectType === type.value).length;
    });

    // 월별 통계
    const monthlyStats = this._getMonthlyStats(projects);

    return {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      completedProjects: completedProjects.length,
      overdueProjects: overdueProjects.length,
      statusStats,
      typeStats,
      monthlyStats,
      averageCompletionTime: this._getAverageCompletionTime(completedProjects),
      completionRate: projects.length > 0 ? (completedProjects.length / projects.length) * 100 : 0
    };
  }

  /**
   * 담당자별 워크로드 조회
   * @returns {Object} 담당자별 워크로드
   */
  getWorkloadByAssignee() {
    const activeProjects = this.storage.getActiveProjects();
    const workload = {};

    activeProjects.forEach(project => {
      const assignee = project.assignee || '미배정';
      if (!workload[assignee]) {
        workload[assignee] = {
          totalProjects: 0,
          urgentProjects: 0,
          overdueProjects: 0
        };
      }

      workload[assignee].totalProjects++;
      
      if (project.priority === 'urgent') {
        workload[assignee].urgentProjects++;
      }

      if (project.endDate && new Date(project.endDate) < new Date()) {
        workload[assignee].overdueProjects++;
      }
    });

    return workload;
  }

  /**
   * 프로젝트 진행률 업데이트
   * @param {string} projectId - 프로젝트 ID
   * @param {number} progress - 진행률 (0-100)
   */
  async updateProgress(projectId, progress) {
    if (progress < 0 || progress > 100) {
      throw new Error('진행률은 0-100 사이의 값이어야 합니다.');
    }

    const updates = { progress };

    // 100% 완료 시 상태 자동 변경
    if (progress === 100) {
      updates.status = 'completed';
      updates.completedDate = new Date().toISOString();
    }

    return this.updateProject(projectId, updates);
  }

  // ========================================
  // 내부 메서드
  // ========================================

  /**
   * 상태 변경 처리
   * @private
   */
  async _handleStatusChange(project, updates) {
    const newStatus = updates.status;
    const oldStatus = project.status;

    // 상태별 특별 처리
    switch (newStatus) {
      case 'quoted':
        // 견적서가 필요한 상태
        updates.quotedDate = new Date().toISOString();
        break;
        
      case 'contracted':
        // 계약 체결 상태
        updates.contractedDate = new Date().toISOString();
        if (!project.startDate) {
          updates.startDate = new Date().toISOString();
        }
        break;
        
      case 'in_progress':
        // 진행 중 상태
        if (!project.startDate) {
          updates.startDate = new Date().toISOString();
        }
        break;
        
      case 'completed':
        // 완료 상태
        updates.completedDate = new Date().toISOString();
        updates.progress = 100;
        break;
        
      case 'cancelled':
        // 취소 상태
        updates.cancelledDate = new Date().toISOString();
        break;
    }

    // 상태 변경 이벤트 발생
    this._dispatchEvent('project:status_changed', {
      projectId: project.id,
      oldStatus,
      newStatus,
      project: { ...project, ...updates }
    });

    return updates;
  }

  /**
   * 관련 문서 존재 확인
   * @private
   */
  _hasRelatedDocuments(projectId) {
    const storageTypes = ['quotes', 'contracts', 'transactions'];
    
    return storageTypes.some(type => {
      const storage = window.OCM_STORAGE_MANAGER?.get(type);
      if (!storage) return false;
      
      return storage.getWhere(doc => doc.projectId === projectId).length > 0;
    });
  }

  /**
   * 월별 통계 계산
   * @private
   */
  _getMonthlyStats(projects) {
    const monthly = {};
    
    projects.forEach(project => {
      const date = new Date(project.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthly[key]) {
        monthly[key] = { created: 0, completed: 0 };
      }
      
      monthly[key].created++;
      
      if (project.status === 'completed') {
        monthly[key].completed++;
      }
    });
    
    return monthly;
  }

  /**
   * 평균 완료 시간 계산
   * @private
   */
  _getAverageCompletionTime(completedProjects) {
    if (completedProjects.length === 0) return 0;
    
    const completionTimes = completedProjects
      .filter(project => project.startDate && project.completedDate)
      .map(project => {
        const start = new Date(project.startDate);
        const end = new Date(project.completedDate);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24)); // 일 단위
      });
    
    if (completionTimes.length === 0) return 0;
    
    return Math.round(completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length);
  }

  /**
   * 이벤트 발생
   * @private
   */
  _dispatchEvent(eventType, data) {
    const event = new CustomEvent(eventType, { detail: data });
    window.dispatchEvent(event);
  }
}

// ========================================
// React 컴포넌트들
// ========================================

const { useState, useEffect, useMemo } = React;

/**
 * 프로젝트 폼 컴포넌트
 */
const ProjectForm = ({ project = null, onSave, onCancel }) => {
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState({
    clientId: '',
    projectTitle: '',
    projectDescription: '',
    projectType: '',
    budgetRange: '',
    priority: 'medium',
    startDate: '',
    endDate: '',
    assignee: '',
    notes: '',
    ...project
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 클라이언트 목록 로드
  useEffect(() => {
    const clientStorage = window.OCM_STORAGE_MANAGER?.get('clients');
    if (clientStorage) {
      setClients(clientStorage.getAll());
    }
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 에러 클리어
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.clientId) {
      newErrors.clientId = '클라이언트를 선택해주세요.';
    }

    if (!formData.projectTitle.trim()) {
      newErrors.projectTitle = '프로젝트 제목을 입력해주세요.';
    }

    if (!formData.projectDescription.trim()) {
      newErrors.projectDescription = '프로젝트 설명을 입력해주세요.';
    }

    if (!formData.projectType) {
      newErrors.projectType = '프로젝트 타입을 선택해주세요.';
    }

    // 날짜 유효성 검사
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) <= new Date(formData.startDate)) {
        newErrors.endDate = '종료일은 시작일보다 나중이어야 합니다.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await onSave(formData);
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const projectTypes = window.OCM_CONSTANTS?.PROJECT_TYPES || [];
  const budgetRanges = window.OCM_CONSTANTS?.BUDGET_RANGES || [];
  const priorities = window.OCM_CONSTANTS?.PRIORITY_LEVELS || {};

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {project ? '프로젝트 수정' : '새 프로젝트 등록'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 클라이언트 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            클라이언트 *
          </label>
          <select
            value={formData.clientId}
            onChange={(e) => handleChange('clientId', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
              errors.clientId ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">클라이언트를 선택하세요</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.companyName} ({client.contactPerson})
              </option>
            ))}
          </select>
          {errors.clientId && (
            <p className="text-red-500 text-sm mt-1">{errors.clientId}</p>
          )}
        </div>

        {/* 프로젝트 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              프로젝트 제목 *
            </label>
            <input
              type="text"
              value={formData.projectTitle}
              onChange={(e) => handleChange('projectTitle', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                errors.projectTitle ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="프로젝트 제목을 입력하세요"
            />
            {errors.projectTitle && (
              <p className="text-red-500 text-sm mt-1">{errors.projectTitle}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              프로젝트 타입 *
            </label>
            <select
              value={formData.projectType}
              onChange={(e) => handleChange('projectType', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                errors.projectType ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">타입을 선택하세요</option>
              {projectTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
            {errors.projectType && (
              <p className="text-red-500 text-sm mt-1">{errors.projectType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              예산 범위
            </label>
            <select
              value={formData.budgetRange}
              onChange={(e) => handleChange('budgetRange', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">예산 범위를 선택하세요</option>
              {budgetRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 프로젝트 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            프로젝트 설명 *
          </label>
          <textarea
            value={formData.projectDescription}
            onChange={(e) => handleChange('projectDescription', e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
              errors.projectDescription ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="프로젝트의 상세 설명을 입력하세요"
          />
          {errors.projectDescription && (
            <p className="text-red-500 text-sm mt-1">{errors.projectDescription}</p>
          )}
        </div>

        {/* 일정 및 담당자 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시작일
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료일
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                errors.endDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.endDate && (
              <p className="text-red-500 text-sm mt-1">{errors.endDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              우선순위
            </label>
            <select
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(priorities).map(([key, value]) => (
                <option key={key} value={key}>
                  {window.OCM_CONSTANTS?.PRIORITY_TEXT?.[key] || value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 담당자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            담당자
          </label>
          <input
            type="text"
            value={formData.assignee}
            onChange={(e) => handleChange('assignee', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="담당자명을 입력하세요"
          />
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            메모
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="추가 정보나 특이사항을 입력하세요"
          />
        </div>

        {/* 에러 메시지 */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{errors.submit}</p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? '저장 중...' : (project ? '수정' : '등록')}
          </button>
        </div>
      </form>
    </div>
  );
};

/**
 * 프로젝트 목록 컴포넌트
 */
const ProjectList = ({ projects, clients, onEdit, onDelete, onViewDetails, onUpdateStatus }) => {
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // 날짜 필드 처리
      if (sortBy.includes('Date') || sortBy.includes('At')) {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      // 문자열 필드 처리
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [projects, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.companyName : '알 수 없음';
  };

  const getStatusBadge = (status) => {
    const colors = window.OCM_CONSTANTS?.STATUS_COLORS || {};
    const texts = window.OCM_CONSTANTS?.STATUS_TEXT || {};
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {texts[status] || status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const colors = window.OCM_CONSTANTS?.PRIORITY_COLORS || {};
    const texts = window.OCM_CONSTANTS?.PRIORITY_TEXT || {};
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority] || 'bg-gray-100 text-gray-800'}`}>
        {texts[priority] || priority}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const isOverdue = (project) => {
    if (!project.endDate || project.status === 'completed') return false;
    return new Date(project.endDate) < new Date();
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">📋</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 프로젝트가 없습니다</h3>
        <p className="text-gray-500">첫 번째 프로젝트를 등록해보세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                { key: 'projectNumber', label: '프로젝트 번호' },
                { key: 'projectTitle', label: '제목' },
                { key: 'clientId', label: '클라이언트' },
                { key: 'projectType', label: '타입' },
                { key: 'status', label: '상태' },
                { key: 'priority', label: '우선순위' },
                { key: 'assignee', label: '담당자' },
                { key: 'endDate', label: '마감일' },
                { key: 'actions', label: '작업' }
              ].map(column => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.key !== 'actions' ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.key !== 'actions' && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.key !== 'actions' && sortBy === column.key && (
                      <span className="text-blue-500">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProjects.map(project => (
              <tr 
                key={project.id} 
                className={`hover:bg-gray-50 ${isOverdue(project) ? 'bg-red-50' : ''}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{project.projectNumber}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900 max-w-xs truncate">
                    {project.projectTitle}
                  </div>
                  {isOverdue(project) && (
                    <div className="text-red-500 text-xs">지연됨</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-900">{getClientName(project.clientId)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-600">
                    {window.OCM_CONSTANTS?.PROJECT_TYPES?.find(t => t.value === project.projectType)?.label || project.projectType}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(project.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getPriorityBadge(project.priority)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-600">{project.assignee || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-gray-600 ${isOverdue(project) ? 'text-red-600 font-medium' : ''}`}>
                    {formatDate(project.endDate)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onViewDetails(project)}
                      className="text-blue-600 hover:text-blue-900"
                      title="상세보기"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => onEdit(project)}
                      className="text-green-600 hover:text-green-900"
                      title="수정"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onUpdateStatus(project)}
                      className="text-purple-600 hover:text-purple-900"
                      title="상태 변경"
                    >
                      🔄
                    </button>
                    <button
                      onClick={() => onDelete(project.id)}
                      className="text-red-600 hover:text-red-900"
                      title="삭제"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * 메인 프로젝트 관리 컴포넌트
 */
const ProjectManagement = () => {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'form', 'details'
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 필터 상태
  const [filterState, setFilterState] = useState({
    query: '',
    status: '',
    clientId: '',
    assignee: '',
    projectType: '',
    priority: '',
    dateFrom: '',
    dateTo: ''
  });

  // 서비스 인스턴스
  const projectService = useMemo(() => {
    const storage = new ProjectStorage();
    return new ProjectService(storage);
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  // 필터 적용
  useEffect(() => {
    applyFilters();
  }, [projects, filterState]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 프로젝트 로드
      const allProjects = projectService.storage.getAll();
      setProjects(allProjects);
      
      // 클라이언트 로드
      const clientStorage = window.OCM_STORAGE_MANAGER?.get('clients');
      if (clientStorage) {
        setClients(clientStorage.getAll());
      }
      
      setError(null);
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다.');
      console.error('데이터 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const hasFilters = Object.values(filterState).some(value => value);
    
    if (!hasFilters) {
      setFilteredProjects(projects);
      return;
    }

    const filtered = projectService.searchProjects(filterState);
    setFilteredProjects(filtered);
  };

  const handleCreateProject = () => {
    setSelectedProject(null);
    setCurrentView('form');
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setCurrentView('form');
  };

  const handleViewDetails = (project) => {
    setSelectedProject(project);
    setCurrentView('details');
  };

  const handleSaveProject = async (projectData) => {
    try {
      if (selectedProject) {
        await projectService.updateProject(selectedProject.id, projectData);
      } else {
        await projectService.createProject(projectData);
      }

      await loadData();
      setCurrentView('list');
      setSelectedProject(null);
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!confirm('정말로 이 프로젝트를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await projectService.deleteProject(projectId);
      await loadData();
    } catch (error) {
      alert(`삭제 실패: ${error.message}`);
    }
  };

  const handleUpdateStatus = async (project) => {
    // 상태 변경 모달 또는 드롭다운 구현
    const statuses = Object.entries(window.OCM_CONSTANTS?.STATUS_TEXT || {});
    const newStatus = prompt(
      `현재 상태: ${window.OCM_CONSTANTS?.STATUS_TEXT?.[project.status] || project.status}\n\n새 상태를 선택하세요:\n${statuses.map((s, i) => `${i + 1}. ${s[1]}`).join('\n')}`,
      project.status
    );

    if (newStatus && newStatus !== project.status) {
      try {
        await projectService.updateProject(project.id, { status: newStatus });
        await loadData();
      } catch (error) {
        alert(`상태 변경 실패: ${error.message}`);
      }
    }
  };

  const handleCancel = () => {
    setCurrentView('list');
    setSelectedProject(null);
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">프로젝트 정보를 불러오는 중...</span>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <h3 className="text-lg font-medium text-red-800">오류 발생</h3>
        <p className="text-red-600 mt-1">{error}</p>
        <button
          onClick={loadData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 뷰별 렌더링
  if (currentView === 'form') {
    return (
      <ProjectForm
        project={selectedProject}
        onSave={handleSaveProject}
        onCancel={handleCancel}
      />
    );
  }

  // 메인 리스트 뷰
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">프로젝트 관리</h1>
          <p className="text-gray-600 mt-1">
            총 {filteredProjects.length}개의 프로젝트
            {Object.values(filterState).some(v => v) ? 
             ` (전체 ${projects.length}개 중 필터링됨)` : ''}
          </p>
        </div>
        <button
          onClick={handleCreateProject}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <span>➕</span>
          <span>새 프로젝트</span>
        </button>
      </div>

      {/* 간단한 필터 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder="프로젝트 검색..."
              value={filterState.query}
              onChange={(e) => setFilterState(prev => ({ ...prev, query: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={filterState.status}
              onChange={(e) => setFilterState(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 상태</option>
              {Object.entries(window.OCM_CONSTANTS?.STATUS_TEXT || {}).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterState.clientId}
              onChange={(e) => setFilterState(prev => ({ ...prev, clientId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 클라이언트</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.companyName}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterState.projectType}
              onChange={(e) => setFilterState(prev => ({ ...prev, projectType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 타입</option>
              {(window.OCM_CONSTANTS?.PROJECT_TYPES || []).map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>

        {Object.values(filterState).some(v => v) && (
          <div className="mt-3">
            <button
              onClick={() => setFilterState({
                query: '', status: '', clientId: '', assignee: '',
                projectType: '', priority: '', dateFrom: '', dateTo: ''
              })}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>

      {/* 프로젝트 목록 */}
      <ProjectList
        projects={filteredProjects}
        clients={clients}
        onEdit={handleEditProject}
        onDelete={handleDeleteProject}
        onViewDetails={handleViewDetails}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
};

// ========================================
// 모듈 초기화 및 전역 노출
// ========================================

// 스토리지 인스턴스 생성 및 등록
const projectStorage = new ProjectStorage();
const projectService = new ProjectService(projectStorage);

// 스토리지 매니저에 등록
if (window.OCM_STORAGE_MANAGER) {
  window.OCM_STORAGE_MANAGER.register('projects', projectStorage);
}

// 전역 객체에 노출
if (typeof window !== 'undefined') {
  window.OCM_PROJECT_MODULE = {
    ProjectStorage,
    ProjectService,
    ProjectManagement,
    ProjectForm,
    ProjectList
  };

  // 서비스 인스턴스도 전역에 노출
  window.OCM_PROJECT_SERVICE = projectService;
  window.OCM_PROJECT_STORAGE = projectStorage;

  // 컴포넌트 등록
  window.OCM_COMPONENTS = window.OCM_COMPONENTS || {};
  window.OCM_COMPONENTS.ProjectManagement = ProjectManagement;
  
  console.log('✅ Project Management Module 로드 완료');
}

export {
  ProjectStorage,
  ProjectService,
  ProjectManagement,
  ProjectForm,
  ProjectList
};