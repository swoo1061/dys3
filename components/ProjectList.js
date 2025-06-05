'use client';

import { useState, useCallback, useMemo } from 'react';
import { FaSearch, FaTrash, FaEdit, FaCheck, FaTimes, FaEye, FaChartBar } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

// 상수 정의
const CONSTANTS = {
  BATCH_SIZE: 5,
  DEBOUNCE_DELAY: 300,
  TABLE_COLUMNS: [
    { id: 'projectName', label: '프로젝트' },
    { id: 'location', label: '위치' },
    { id: 'generalManager', label: '총괄' },
    { id: 'inspector', label: '검수자' },
    { id: 'inspectionDate', label: '검수일자' },
    { id: 'uploadDate', label: '업로드일자' }
  ]
};

// 유틸리티 함수
const utils = {
  formatDate: (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  },
  debounce: (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }
};

// API 호출 유틸리티
const api = {
  deleteProject: async (id) => {
    const response = await fetch('/api/projects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || '삭제 실패');
    }
    
    return response.json();
  },

  updateProject: async (id, data) => {
    const response = await fetch('/api/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || '수정 실패');
    }
    
    return response.json();
  }
};

// 상태 관리 유틸리티
const stateUtils = {
  updateSelectedProjects: (prev, projectId) => {
    if (prev.includes(projectId)) {
      return prev.filter(id => id !== projectId);
    }
    return [...prev, projectId];
  },
  
  updateAllSelected: (prev, filteredProjects) => {
    if (prev.length === filteredProjects.length) {
      return [];
    }
    return filteredProjects.map(p => p.id);
  }
};

export default function ProjectList({ projects = [], onRefresh }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editForm, setEditForm] = useState({
    projectName: '',
    location: '',
    generalManager: '',
    inspector: '',
    inspectionDate: ''
  });

  // 검색어 변경 핸들러 최적화
  const handleSearchChange = useCallback(
    utils.debounce((e) => {
      setSearchTerm(e.target.value);
    }, CONSTANTS.DEBOUNCE_DELAY),
    []
  );

  // 프로젝트 필터링 최적화
  const filteredProjects = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return projects.filter(project =>
      project.projectName?.toLowerCase().includes(term) ||
      project.location?.toLowerCase().includes(term) ||
      project.generalManager?.toLowerCase().includes(term) ||
      project.inspector?.toLowerCase().includes(term)
    );
  }, [projects, searchTerm]);

  // 프로젝트 선택 핸들러 최적화
  const handleProjectSelect = useCallback((projectId) => {
    setSelectedProjects(prev => stateUtils.updateSelectedProjects(prev, projectId));
  }, []);

  // 전체 선택 핸들러 최적화
  const handleSelectAll = useCallback(() => {
    setSelectedProjects(prev => stateUtils.updateAllSelected(prev, filteredProjects));
  }, [filteredProjects]);

  // 편집 시작
  const handleEditStart = useCallback((project) => {
    setEditingProject(project.id);
    setEditForm({
      projectName: project.projectName || '',
      location: project.location || '',
      generalManager: project.generalManager || '',
      inspector: project.inspector || '',
      inspectionDate: project.inspectionDate || ''
    });
  }, []);

  // 편집 취소
  const handleEditCancel = useCallback(() => {
    setEditingProject(null);
    setEditForm({
      projectName: '',
      location: '',
      generalManager: '',
      inspector: '',
      inspectionDate: ''
    });
  }, []);

  // 편집 저장
  const handleEditSave = useCallback(async (projectId) => {
    try {
      const result = await api.updateProject(projectId, editForm);
      if (result.success) {
        setEditingProject(null);
        setEditForm({
          projectName: '',
          location: '',
          generalManager: '',
          inspector: '',
          inspectionDate: ''
        });
        onRefresh?.();
        alert('프로젝트가 수정되었습니다.');
      } else {
        throw new Error(result.error || '수정 실패');
      }
    } catch (error) {
      console.error('프로젝트 수정 오류:', error);
      alert('수정 중 오류가 발생했습니다: ' + error.message);
    }
  }, [editForm, onRefresh]);

  // 개별 삭제
  const handleSingleDelete = useCallback(async (project) => {
    if (!confirm(`"${project.projectName}" 프로젝트를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const result = await api.deleteProject(project.id);
      if (result.success) {
        onRefresh?.();
        alert('프로젝트가 삭제되었습니다.');
      } else {
        throw new Error(result.error || '삭제 실패');
      }
    } catch (error) {
      console.error('프로젝트 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
  }, [onRefresh]);

  // 일괄 삭제 핸들러 최적화
  const handleBulkDelete = useCallback(async () => {
    if (selectedProjects.length === 0) {
      alert('삭제할 프로젝트를 선택해주세요.');
      return;
    }

    const selectedNames = projects
      .filter(p => selectedProjects.includes(p.id))
      .map(p => p.projectName)
      .join(', ');

    if (!confirm(`선택한 프로젝트들을 삭제하시겠습니까?\n\n${selectedNames}`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const batchSize = CONSTANTS.BATCH_SIZE;
      const results = [];
      
      for (let i = 0; i < selectedProjects.length; i += batchSize) {
        const batch = selectedProjects.slice(i, i + batchSize);
        const batchPromises = batch.map(id => api.deleteProject(id));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const failures = results.filter(r => !r.success);
      
      if (failures.length === 0) {
        alert(`${selectedProjects.length}개 프로젝트가 삭제되었습니다.`);
        setSelectedProjects([]);
        onRefresh?.();
      } else {
        throw new Error(`${failures.length}개 프로젝트 삭제 실패`);
      }
    } catch (error) {
      console.error('일괄 삭제 오류:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedProjects, projects, onRefresh]);

  // 평가표 보기 (해당 프로젝트만)
  const handleViewEvaluation = useCallback((projectId) => {
    router.push(`/project-summary/${projectId}`);
  }, [router]);

  // 검수 시트 보기
  const handleViewSheet = useCallback((projectId) => {
    router.push(`/sheet/${projectId}`);
  }, [router]);

  // 테이블 헤더 렌더링 최적화
  const renderTableHeader = useMemo(() => (
    <thead>
      <tr className="bg-gray-50">
        <th className="px-4 py-2 border-b">
          <input
            type="checkbox"
            checked={selectedProjects.length === filteredProjects.length && filteredProjects.length > 0}
            onChange={handleSelectAll}
            className="rounded"
          />
        </th>
        {CONSTANTS.TABLE_COLUMNS.map(column => (
          <th key={column.id} className="px-4 py-2 border-b text-left">
            {column.label}
          </th>
        ))}
        <th className="px-4 py-2 border-b">관리</th>
      </tr>
    </thead>
  ), [selectedProjects.length, filteredProjects.length, handleSelectAll]);

  // 테이블 행 렌더링 최적화
  const renderTableRows = useMemo(() => (
    <tbody>
      {filteredProjects.map((project) => (
        <tr key={project.id} className="hover:bg-gray-50">
          <td className="px-4 py-2 border-b">
            <input
              type="checkbox"
              checked={selectedProjects.includes(project.id)}
              onChange={() => handleProjectSelect(project.id)}
              className="rounded"
            />
          </td>
          
          {/* 프로젝트명 */}
          <td className="px-4 py-2 border-b">
            {editingProject === project.id ? (
              <input
                type="text"
                value={editForm.projectName}
                onChange={(e) => setEditForm({...editForm, projectName: e.target.value})}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              project.projectName
            )}
          </td>
          
          {/* 위치 */}
          <td className="px-4 py-2 border-b">
            {editingProject === project.id ? (
              <input
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              project.location
            )}
          </td>
          
          {/* 총괄 */}
          <td className="px-4 py-2 border-b">
            {editingProject === project.id ? (
              <input
                type="text"
                value={editForm.generalManager}
                onChange={(e) => setEditForm({...editForm, generalManager: e.target.value})}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              project.generalManager
            )}
          </td>
          
          {/* 검수자 */}
          <td className="px-4 py-2 border-b">
            {editingProject === project.id ? (
              <input
                type="text"
                value={editForm.inspector}
                onChange={(e) => setEditForm({...editForm, inspector: e.target.value})}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              project.inspector
            )}
          </td>
          
          {/* 검수일자 */}
          <td className="px-4 py-2 border-b">
            {editingProject === project.id ? (
              <input
                type="date"
                value={editForm.inspectionDate}
                onChange={(e) => setEditForm({...editForm, inspectionDate: e.target.value})}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              project.inspectionDate || '-'
            )}
          </td>
          
          {/* 업로드일자 */}
          <td className="px-4 py-2 border-b">{project.uploadDate}</td>
          
          {/* 관리 버튼들 */}
          <td className="px-4 py-2 border-b">
            <div className="flex space-x-1">
              {editingProject === project.id ? (
                // 편집 모드일 때
                <>
                  <button
                    onClick={() => handleEditSave(project.id)}
                    className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded transition-colors"
                    title="저장"
                  >
                    <FaCheck size={14} />
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                    title="취소"
                  >
                    <FaTimes size={14} />
                  </button>
                </>
              ) : (
                // 일반 모드일 때 - 수정된 3개 버튼만
                <>
                  <button
                    onClick={() => handleViewEvaluation(project.id)}
                    className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded transition-colors"
                    title="평가표 보기"
                  >
                    <FaChartBar size={14} />
                  </button>
                  <button
                    onClick={() => handleEditStart(project)}
                    className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded transition-colors"
                    title="편집"
                  >
                    <FaEdit size={14} />
                  </button>
                  <button
                    onClick={() => handleSingleDelete(project)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                    title="삭제"
                  >
                    <FaTrash size={14} />
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  ), [
    filteredProjects, 
    selectedProjects, 
    editingProject, 
    editForm,
    handleProjectSelect, 
    handleViewEvaluation,
    handleEditStart, 
    handleEditSave, 
    handleEditCancel, 
    handleSingleDelete
  ]);

  return (
    <div className="space-y-4">
      {/* 검색 및 일괄 삭제 영역 */}
      <div className="flex justify-between items-center">
        <div className="relative">
          <input
            type="text"
            placeholder="프로젝트 검색..."
            onChange={handleSearchChange}
            className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleBulkDelete}
            disabled={selectedProjects.length === 0 || isDeleting}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
              selectedProjects.length === 0 || isDeleting
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            <FaTrash />
            <span>선택 삭제 ({selectedProjects.length})</span>
          </button>
        </div>
      </div>

      {/* 프로젝트 개수 표시 */}
      <div className="text-sm text-gray-600">
        총 {filteredProjects.length}개 프로젝트
        {searchTerm && ` (검색: "${searchTerm}")`}
      </div>

      {/* 프로젝트 목록 테이블 */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full">
          {renderTableHeader}
          {renderTableRows}
        </table>
      </div>

      {/* 빈 상태 */}
      {filteredProjects.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-500">
            {searchTerm ? '검색 결과가 없습니다.' : '등록된 프로젝트가 없습니다.'}
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {isDeleting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span>삭제 중...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}