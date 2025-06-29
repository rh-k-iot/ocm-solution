/**
 * OCM Client Management Module
 * 클라이언트 관리 통합 모듈
 */

import { BaseStorage } from '../data/base-storage.js';

// ========================================
// 클라이언트 스토리지 클래스
// ========================================

class ClientStorage extends BaseStorage {
  constructor() {
    super('clients', {
      autoSave: true,
      validation: true
    });
  }

  /**
   * 클라이언트 데이터 유효성 검사
   * @param {Object} data - 검사할 클라이언트 데이터
   */
  validate(data) {
    const required = ['companyName', 'contactPerson', 'email', 'phone'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`필수 필드가 누락되었습니다: ${missing.join(', ')}`);
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('올바른 이메일 형식이 아닙니다.');
    }

    // 전화번호 형식 검사 (간단한 검사)
    const phoneRegex = /^[\d-+().\s]+$/;
    if (!phoneRegex.test(data.phone)) {
      throw new Error('올바른 전화번호 형식이 아닙니다.');
    }
  }

  /**
   * 회사명으로 검색
   * @param {string} companyName - 회사명
   * @returns {Array} 검색 결과
   */
  searchByCompany(companyName) {
    const query = companyName.toLowerCase();
    return this.getWhere(client => 
      client.companyName.toLowerCase().includes(query)
    );
  }

  /**
   * 담당자명으로 검색
   * @param {string} contactPerson - 담당자명
   * @returns {Array} 검색 결과
   */
  searchByContact(contactPerson) {
    const query = contactPerson.toLowerCase();
    return this.getWhere(client => 
      client.contactPerson.toLowerCase().includes(query)
    );
  }

  /**
   * 이메일로 검색
   * @param {string} email - 이메일
   * @returns {Object|null} 검색 결과
   */
  getByEmail(email) {
    return this.getWhere(client => 
      client.email.toLowerCase() === email.toLowerCase()
    )[0] || null;
  }

  /**
   * 클라이언트 유형별 조회
   * @param {string} clientType - 클라이언트 유형
   * @returns {Array} 검색 결과
   */
  getByType(clientType) {
    return this.getWhere(client => client.clientType === clientType);
  }

  /**
   * 최근 생성된 클라이언트 조회
   * @param {number} limit - 조회할 개수
   * @returns {Array} 최근 클라이언트 목록
   */
  getRecent(limit = 10) {
    return this.getAll()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }
}

// ========================================
// 클라이언트 서비스 클래스
// ========================================

class ClientService {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * 클라이언트 생성
   * @param {Object} clientData - 클라이언트 데이터
   * @returns {Object} 생성된 클라이언트
   */
  async createClient(clientData) {
    try {
      // 이메일 중복 확인
      const existingClient = this.storage.getByEmail(clientData.email);
      if (existingClient) {
        throw new Error('이미 등록된 이메일입니다.');
      }

      // 기본값 설정
      const newClient = {
        ...clientData,
        clientType: clientData.clientType || 'corporate',
        status: 'active',
        totalProjects: 0,
        totalRevenue: 0,
        lastContactDate: new Date().toISOString()
      };

      const created = this.storage.create(newClient);
      
      // 관련 이벤트 발생
      this._dispatchEvent('client:created', created);
      
      return created;
    } catch (error) {
      console.error('클라이언트 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 클라이언트 정보 업데이트
   * @param {string} id - 클라이언트 ID
   * @param {Object} updates - 업데이트할 데이터
   * @returns {Object} 업데이트된 클라이언트
   */
  async updateClient(id, updates) {
    try {
      const updated = this.storage.update(id, {
        ...updates,
        lastModifiedDate: new Date().toISOString()
      });

      this._dispatchEvent('client:updated', updated);
      return updated;
    } catch (error) {
      console.error('클라이언트 업데이트 오류:', error);
      throw error;
    }
  }

  /**
   * 클라이언트 삭제
   * @param {string} id - 클라이언트 ID
   * @returns {boolean} 삭제 성공 여부
   */
  async deleteClient(id) {
    try {
      // 관련 프로젝트 확인
      const hasProjects = this._hasRelatedProjects(id);
      if (hasProjects) {
        throw new Error('진행 중인 프로젝트가 있어 삭제할 수 없습니다.');
      }

      const client = this.storage.getById(id);
      const success = this.storage.delete(id);

      if (success) {
        this._dispatchEvent('client:deleted', { id, client });
      }

      return success;
    } catch (error) {
      console.error('클라이언트 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * 클라이언트 검색
   * @param {Object} searchParams - 검색 조건
   * @returns {Array} 검색 결과
   */
  searchClients(searchParams) {
    const { 
      query, 
      clientType, 
      status, 
      dateFrom, 
      dateTo 
    } = searchParams;

    let results = this.storage.getAll();

    // 텍스트 검색
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(client => 
        client.companyName.toLowerCase().includes(lowerQuery) ||
        client.contactPerson.toLowerCase().includes(lowerQuery) ||
        client.email.toLowerCase().includes(lowerQuery)
      );
    }

    // 클라이언트 유형 필터
    if (clientType) {
      results = results.filter(client => client.clientType === clientType);
    }

    // 상태 필터
    if (status) {
      results = results.filter(client => client.status === status);
    }

    // 날짜 범위 필터
    if (dateFrom || dateTo) {
      results = results.filter(client => {
        const createdDate = new Date(client.createdAt);
        if (dateFrom && createdDate < new Date(dateFrom)) return false;
        if (dateTo && createdDate > new Date(dateTo)) return false;
        return true;
      });
    }

    return results;
  }

  /**
   * 클라이언트 통계 정보
   * @param {string} clientId - 클라이언트 ID
   * @returns {Object} 통계 정보
   */
  getClientStats(clientId) {
    const client = this.storage.getById(clientId);
    if (!client) return null;

    // 관련 프로젝트 조회
    const projects = this._getClientProjects(clientId);
    const quotes = this._getClientQuotes(clientId);
    const contracts = this._getClientContracts(clientId);

    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => ['in_progress', 'contracted'].includes(p.status)).length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      totalQuotes: quotes.length,
      acceptedQuotes: quotes.filter(q => q.status === 'accepted').length,
      totalRevenue: contracts.reduce((sum, c) => sum + (c.contractAmount || 0), 0),
      averageProjectValue: contracts.length > 0 ? 
        contracts.reduce((sum, c) => sum + (c.contractAmount || 0), 0) / contracts.length : 0,
      lastProjectDate: projects.length > 0 ? 
        Math.max(...projects.map(p => new Date(p.createdAt))) : null,
      conversionRate: quotes.length > 0 ? 
        (quotes.filter(q => q.status === 'accepted').length / quotes.length) * 100 : 0
    };
  }

  /**
   * 전체 클라이언트 통계
   * @returns {Object} 전체 통계
   */
  getOverallStats() {
    const clients = this.storage.getAll();
    const activeClients = clients.filter(c => c.status === 'active');

    return {
      totalClients: clients.length,
      activeClients: activeClients.length,
      corporateClients: clients.filter(c => c.clientType === 'corporate').length,
      individualClients: clients.filter(c => c.clientType === 'individual').length,
      newClientsThisMonth: clients.filter(c => {
        const created = new Date(c.createdAt);
        const thisMonth = new Date();
        return created.getMonth() === thisMonth.getMonth() && 
               created.getFullYear() === thisMonth.getFullYear();
      }).length,
      averageProjectsPerClient: activeClients.length > 0 ? 
        activeClients.reduce((sum, c) => sum + (c.totalProjects || 0), 0) / activeClients.length : 0
    };
  }

  /**
   * 관련 프로젝트 확인
   * @private
   */
  _hasRelatedProjects(clientId) {
    // 프로젝트 스토리지에서 확인
    const projectStorage = window.OCM_STORAGE_MANAGER?.get('projects');
    if (!projectStorage) return false;

    const activeProjects = projectStorage.getWhere(project => 
      project.clientId === clientId && 
      !['completed', 'cancelled'].includes(project.status)
    );

    return activeProjects.length > 0;
  }

  /**
   * 클라이언트 프로젝트 조회
   * @private
   */
  _getClientProjects(clientId) {
    const projectStorage = window.OCM_STORAGE_MANAGER?.get('projects');
    if (!projectStorage) return [];

    return projectStorage.getWhere(project => project.clientId === clientId);
  }

  /**
   * 클라이언트 견적서 조회
   * @private
   */
  _getClientQuotes(clientId) {
    const quoteStorage = window.OCM_STORAGE_MANAGER?.get('quotes');
    if (!quoteStorage) return [];

    return quoteStorage.getWhere(quote => quote.clientId === clientId);
  }

  /**
   * 클라이언트 계약서 조회
   * @private
   */
  _getClientContracts(clientId) {
    const contractStorage = window.OCM_STORAGE_MANAGER?.get('contracts');
    if (!contractStorage) return [];

    return contractStorage.getWhere(contract => contract.clientId === clientId);
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
 * 클라이언트 폼 컴포넌트
 */
const ClientForm = ({ client = null, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    clientType: 'corporate',
    notes: '',
    ...client
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 에러 클리어
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = '회사명을 입력해주세요.';
    }

    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = '담당자명을 입력해주세요.';
    }

    if (!formData.email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = '올바른 이메일 형식이 아닙니다.';
      }
    }

    if (!formData.phone.trim()) {
      newErrors.phone = '전화번호를 입력해주세요.';
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

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {client ? '클라이언트 수정' : '새 클라이언트 등록'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 클라이언트 유형 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            클라이언트 유형
          </label>
          <div className="flex space-x-4">
            {[
              { value: 'corporate', label: '기업' },
              { value: 'individual', label: '개인' }
            ].map(type => (
              <label key={type.value} className="flex items-center">
                <input
                  type="radio"
                  name="clientType"
                  value={type.value}
                  checked={formData.clientType === type.value}
                  onChange={(e) => handleChange('clientType', e.target.value)}
                  className="mr-2"
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        {/* 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              회사명 *
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                errors.companyName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="회사명을 입력하세요"
            />
            {errors.companyName && (
              <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              담당자명 *
            </label>
            <input
              type="text"
              value={formData.contactPerson}
              onChange={(e) => handleChange('contactPerson', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                errors.contactPerson ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="담당자명을 입력하세요"
            />
            {errors.contactPerson && (
              <p className="text-red-500 text-sm mt-1">{errors.contactPerson}</p>
            )}
          </div>
        </div>

        {/* 연락처 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일 *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="example@company.com"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                errors.phone ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="02-1234-5678"
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* 추가 정보 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            웹사이트
          </label>
          <input
            type="url"
            value={formData.website}
            onChange={(e) => handleChange('website', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="https://www.company.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            주소
          </label>
          <textarea
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="주소를 입력하세요"
          />
        </div>

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
            {isSubmitting ? '저장 중...' : (client ? '수정' : '등록')}
          </button>
        </div>
      </form>
    </div>
  );
};

/**
 * 클라이언트 목록 컴포넌트
 */
const ClientList = ({ clients, onEdit, onDelete, onViewDetails }) => {
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
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
  }, [clients, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800'
    };

    const labels = {
      active: '활성',
      inactive: '비활성',
      suspended: '정지'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.active}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const colors = {
      corporate: 'bg-blue-100 text-blue-800',
      individual: 'bg-purple-100 text-purple-800'
    };

    const labels = {
      corporate: '기업',
      individual: '개인'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type] || colors.corporate}`}>
        {labels[type] || type}
      </span>
    );
  };

  if (clients.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">👥</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 클라이언트가 없습니다</h3>
        <p className="text-gray-500">첫 번째 클라이언트를 등록해보세요.</p>
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
                { key: 'companyName', label: '회사명' },
                { key: 'contactPerson', label: '담당자' },
                { key: 'clientType', label: '유형' },
                { key: 'email', label: '이메일' },
                { key: 'phone', label: '전화번호' },
                { key: 'status', label: '상태' },
                { key: 'createdAt', label: '등록일' },
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
            {sortedClients.map(client => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{client.companyName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-900">{client.contactPerson}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getTypeBadge(client.clientType)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-600">{client.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-600">{client.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(client.status || 'active')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {formatDate(client.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onViewDetails(client)}
                      className="text-blue-600 hover:text-blue-900"
                      title="상세보기"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => onEdit(client)}
                      className="text-green-600 hover:text-green-900"
                      title="수정"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete(client.id)}
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
 * 클라이언트 상세 정보 컴포넌트
 */
const ClientDetails = ({ client, onClose, onEdit }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (client) {
      loadClientStats();
    }
  }, [client]);

  const loadClientStats = async () => {
    try {
      setLoading(true);
      const clientService = window.OCM_CLIENT_SERVICE;
      const clientStats = clientService.getClientStats(client.id);
      setStats(clientStats);
    } catch (error) {
      console.error('통계 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!client) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-gray-900">클라이언트 상세 정보</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 기본 정보 */}
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">회사명</dt>
                    <dd className="text-sm text-gray-900">{client.companyName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">담당자</dt>
                    <dd className="text-sm text-gray-900">{client.contactPerson}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">이메일</dt>
                    <dd className="text-sm text-gray-900">{client.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">전화번호</dt>
                    <dd className="text-sm text-gray-900">{client.phone}</dd>
                  </div>
                  {client.website && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">웹사이트</dt>
                      <dd className="text-sm text-blue-600">
                        <a href={client.website} target="_blank" rel="noopener noreferrer">
                          {client.website}
                        </a>
                      </dd>
                    </div>
                  )}
                  {client.address && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">주소</dt>
                      <dd className="text-sm text-gray-900">{client.address}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {client.notes && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">메모</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
          <div className="mt-8 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
            <button
              onClick={() => onEdit(client)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              수정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 클라이언트 검색 필터 컴포넌트
 */
const ClientSearchFilter = ({ onFilterChange, filterState }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (field, value) => {
    onFilterChange({
      ...filterState,
      [field]: value
    });
  };

  const clearFilters = () => {
    onFilterChange({
      query: '',
      clientType: '',
      status: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  const hasActiveFilters = Object.values(filterState).some(value => value);

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex justify-between items-center">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="회사명, 담당자명, 이메일로 검색..."
            value={filterState.query}
            onChange={(e) => handleFilterChange('query', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-center space-x-3">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              필터 초기화
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            {isExpanded ? '간단히' : '상세검색'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              클라이언트 유형
            </label>
            <select
              value={filterState.clientType}
              onChange={(e) => handleFilterChange('clientType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              <option value="corporate">기업</option>
              <option value="individual">개인</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태
            </label>
            <select
              value={filterState.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="suspended">정지</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              등록일 시작
            </label>
            <input
              type="date"
              value={filterState.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              등록일 종료
            </label>
            <input
              type="date"
              value={filterState.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 메인 클라이언트 관리 컴포넌트
 */
const ClientManagement = () => {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'form', 'details'
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 필터 상태
  const [filterState, setFilterState] = useState({
    query: '',
    clientType: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  // 서비스 인스턴스
  const clientService = useMemo(() => {
    const storage = new ClientStorage();
    return new ClientService(storage);
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    loadClients();
  }, []);

  // 필터 적용
  useEffect(() => {
    applyFilters();
  }, [clients, filterState]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const allClients = clientService.storage.getAll();
      setClients(allClients);
      setError(null);
    } catch (err) {
      setError('클라이언트 데이터를 불러오는데 실패했습니다.');
      console.error('클라이언트 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    if (!filterState.query && !filterState.clientType && !filterState.status && 
        !filterState.dateFrom && !filterState.dateTo) {
      setFilteredClients(clients);
      return;
    }

    const filtered = clientService.searchClients(filterState);
    setFilteredClients(filtered);
  };

  const handleCreateClient = () => {
    setSelectedClient(null);
    setCurrentView('form');
  };

  const handleEditClient = (client) => {
    setSelectedClient(client);
    setCurrentView('form');
  };

  const handleViewDetails = (client) => {
    setSelectedClient(client);
    setCurrentView('details');
  };

  const handleSaveClient = async (clientData) => {
    try {
      if (selectedClient) {
        // 수정
        await clientService.updateClient(selectedClient.id, clientData);
      } else {
        // 새로 생성
        await clientService.createClient(clientData);
      }

      await loadClients();
      setCurrentView('list');
      setSelectedClient(null);
    } catch (error) {
      throw error; // 폼에서 에러 처리
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!confirm('정말로 이 클라이언트를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await clientService.deleteClient(clientId);
      await loadClients();
    } catch (error) {
      alert(`삭제 실패: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setCurrentView('list');
    setSelectedClient(null);
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">클라이언트 정보를 불러오는 중...</span>
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
          onClick={loadClients}
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
      <ClientForm
        client={selectedClient}
        onSave={handleSaveClient}
        onCancel={handleCancel}
      />
    );
  }

  if (currentView === 'details') {
    return (
      <ClientDetails
        client={selectedClient}
        onClose={handleCancel}
        onEdit={handleEditClient}
      />
    );
  }

  // 메인 리스트 뷰
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">클라이언트 관리</h1>
          <p className="text-gray-600 mt-1">
            총 {filteredClients.length}개의 클라이언트
            {filterState.query || filterState.clientType || filterState.status || 
             filterState.dateFrom || filterState.dateTo ? 
             ` (전체 ${clients.length}개 중 필터링됨)` : ''}
          </p>
        </div>
        <button
          onClick={handleCreateClient}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <span>➕</span>
          <span>새 클라이언트</span>
        </button>
      </div>

      {/* 검색 및 필터 */}
      <ClientSearchFilter
        filterState={filterState}
        onFilterChange={setFilterState}
      />

      {/* 클라이언트 목록 */}
      <ClientList
        clients={filteredClients}
        onEdit={handleEditClient}
        onDelete={handleDeleteClient}
        onViewDetails={handleViewDetails}
      />
    </div>
  );
};

// ========================================
// 모듈 초기화 및 전역 노출
// ========================================

// 스토리지 인스턴스 생성 및 등록
const clientStorage = new ClientStorage();
const clientService = new ClientService(clientStorage);

// 스토리지 매니저에 등록
if (window.OCM_STORAGE_MANAGER) {
  window.OCM_STORAGE_MANAGER.register('clients', clientStorage);
}

// 전역 객체에 노출
if (typeof window !== 'undefined') {
  window.OCM_CLIENT_MODULE = {
    ClientStorage,
    ClientService,
    ClientManagement,
    ClientForm,
    ClientList,
    ClientDetails,
    ClientSearchFilter
  };

  // 서비스 인스턴스도 전역에 노출
  window.OCM_CLIENT_SERVICE = clientService;
  window.OCM_CLIENT_STORAGE = clientStorage;

  // 컴포넌트 등록
  window.OCM_COMPONENTS = window.OCM_COMPONENTS || {};
  window.OCM_COMPONENTS.ClientManagement = ClientManagement;
  
  console.log('✅ Client Management Module 로드 완료');
}

export {
  ClientStorage,
  ClientService,
  ClientManagement,
  ClientForm,
  ClientList,
  ClientDetails,
  ClientSearchFilter
};