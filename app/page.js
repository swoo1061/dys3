// app/page.js - 메인 프로젝트 목록 페이지 (평가 집계표 탭 추가)
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProjectList from '@/components/ProjectList';
import FileUpload from '@/components/FileUpload';

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    // 프로젝트 목록 불러오기
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const handleSummaryTab = () => {
    // 집계표 페이지로 이동
    router.push('/summary');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            건축 현장 업무 검수 시스템
          </h1>
        </div>
      </header>

      {/* 탭 메뉴 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('projects')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'projects'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              프로젝트 목록
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              신규 업로드
            </button>
            <button
              onClick={handleSummaryTab}
              className="py-2 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-blue-500 transition-colors"
            >
              📊 평가 집계표
            </button>
          </nav>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'projects' && (
          <ProjectList projects={projects} onRefresh={fetchProjects} />
        )}
        {activeTab === 'upload' && (
          <FileUpload onUploadComplete={fetchProjects} />
        )}
      </main>
    </div>
  );
}