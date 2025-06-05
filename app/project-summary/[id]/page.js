'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ProjectSummary() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [summaryData, setSummaryData] = useState({
    대분류별: {},
    중분류별: {},
    담당자별: {},
    전체점수: { total: 0, max: 0, percentage: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('category'); // 'category' or 'manager'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedCategoryManager, setSelectedCategoryManager] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedManagerCategory, setSelectedManagerCategory] = useState(null);

  useEffect(() => {
    loadProjectSummaryData();
  }, [params.id]);

  const loadProjectSummaryData = async () => {
    try {
      // 프로젝트 정보 가져오기
      const projectsRes = await fetch('/api/projects');
      const projects = await projectsRes.json();
      
      const currentProject = projects.find(p => p.id === parseInt(params.id));
      
      if (!currentProject) {
        alert('프로젝트를 찾을 수 없습니다.');
        router.push('/');
        return;
      }
      
      setProject(currentProject);
      
      // 해당 프로젝트의 Excel 데이터 로드
      const excelRes = await fetch('/api/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: currentProject.filePath })
      });
      
      const excelData = await excelRes.json();
      
      if (excelData.success && excelData.data && excelData.data.length > 1) {
        const summary = calculateSummary(excelData.data, excelData.projectInfo?.projectName || currentProject.projectName);
        setSummaryData(summary);
      }
      
    } catch (error) {
      console.error('Failed to load project summary:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 안전한 숫자 파싱 함수
  const safeParseNumber = (value, defaultValue = 0) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  // 안전한 점수범위 파싱 함수
  const safeParseScoreRange = (value) => {
    const defaultRange = { min: 0, max: 1 };
    
    if (!value) {
      return defaultRange;
    }
    
    // 값을 문자열로 변환
    const strValue = String(value).trim();
    
    if (!strValue || !strValue.includes('/')) {
      return defaultRange;
    }
    
    try {
      const parts = strValue.split('/');
      if (parts.length !== 2) {
        return defaultRange;
      }
      
      const min = safeParseNumber(parts[0], 0);
      const max = safeParseNumber(parts[1], 1);
      
      return { min, max };
    } catch (error) {
      console.error('Error parsing score range:', value, error);
      return defaultRange;
    }
  };

  const calculateSummary = (data, projectName) => {
    const summary = {
      대분류별: {},
      중분류별: {},
      담당자별: {}
    };
    
    let totalScore = 0;
    let totalMaxScore = 0;
    
    // 헤더 제외하고 데이터 처리
    let prev대분류 = "";
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // 모든 셀이 비어있는 행은 건너뛰기
      if (row.every(cell => !cell || cell.toString().trim() === "")) continue;
      
      // 대분류가 비어있으면 이전 값 사용
      if (row[0]?.value) {
        prev대분류 = row[0].value;
      }
      
      // 점수 처리 - 안전하게 변환
      const score = safeParseNumber(row[5]?.value, 0);
      
      // 점수범위 처리 - 안전하게 파싱
      const scoreRange = safeParseScoreRange(row[6]?.value);
      const maxScore = scoreRange.max;
      
      totalScore += score;
      totalMaxScore += maxScore;
      
      const item = {
        project: projectName,
        대분류: row[0]?.value || prev대분류,
        중분류: row[1]?.value || '',
        소분류: row[2]?.value || '',
        임무: row[3]?.value || '',
        담당자: row[4]?.value || '',
        점수: score,
        최대점수: maxScore,
        점수범위: `${scoreRange.min}/${scoreRange.max}`
      };
      
      // 대분류별 집계
      if (!summary.대분류별[item.대분류]) {
        summary.대분류별[item.대분류] = {
          점수합: 0,
          최대점수합: 0,
          항목수: 0,
          담당자목록: new Set(),
          중분류: {}
        };
      }
      summary.대분류별[item.대분류].점수합 += item.점수;
      summary.대분류별[item.대분류].최대점수합 += item.최대점수;
      summary.대분류별[item.대분류].항목수 += 1;
      summary.대분류별[item.대분류].담당자목록.add(item.담당자);
      
      // 중분류별 집계
      if (!summary.대분류별[item.대분류].중분류[item.중분류]) {
        summary.대분류별[item.대분류].중분류[item.중분류] = {
          점수합: 0,
          최대점수합: 0,
          항목수: 0,
          소분류: {}
        };
      }
      summary.대분류별[item.대분류].중분류[item.중분류].점수합 += item.점수;
      summary.대분류별[item.대분류].중분류[item.중분류].최대점수합 += item.최대점수;
      summary.대분류별[item.대분류].중분류[item.중분류].항목수 += 1;
      
      // 소분류가 있는 경우
      if (item.소분류) {
        if (!summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류]) {
          summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류] = {
            점수합: 0,
            최대점수합: 0,
            항목수: 0
          };
        }
        summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류].점수합 += item.점수;
        summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류].최대점수합 += item.최대점수;
        summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류].항목수 += 1;
      }
      
      // 담당자별 집계
      if (!summary.담당자별[item.담당자]) {
        summary.담당자별[item.담당자] = {
          점수합: 0,
          최대점수합: 0,
          항목수: 0,
          대분류별: {}
        };
      }
      summary.담당자별[item.담당자].점수합 += item.점수;
      summary.담당자별[item.담당자].최대점수합 += item.최대점수;
      summary.담당자별[item.담당자].항목수 += 1;
      
      // 담당자별 대분류별 집계
      if (!summary.담당자별[item.담당자].대분류별[item.대분류]) {
        summary.담당자별[item.담당자].대분류별[item.대분류] = {
          점수합: 0,
          최대점수합: 0,
          중분류별: {}
        };
      }
      summary.담당자별[item.담당자].대분류별[item.대분류].점수합 += item.점수;
      summary.담당자별[item.담당자].대분류별[item.대분류].최대점수합 += item.최대점수;
      
      // 담당자별 중분류별 집계
      if (!summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류]) {
        summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류] = {
          점수합: 0,
          최대점수합: 0,
          소분류별: {}
        };
      }
      summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].점수합 += item.점수;
      summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].최대점수합 += item.최대점수;
      
      // 담당자별 소분류별 집계
      if (item.소분류) {
        if (!summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류]) {
          summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류] = {
            점수합: 0,
            최대점수합: 0
          };
        }
        summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류].점수합 += item.점수;
        summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류].최대점수합 += item.최대점수;
      }
    }
    
    summary.전체점수 = {
      total: totalScore,
      max: totalMaxScore,
      percentage: totalMaxScore > 0 ? (totalScore / totalMaxScore * 100).toFixed(1) : 0
    };
    
    return summary;
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 80) return 'text-blue-600 bg-blue-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const handleBack = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">집계 중...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">프로젝트를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              프로젝트 평가 집계표
            </h1>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              목록으로
            </button>
          </div>
        </div>
      </header>

      {/* 프로젝트 정보 카드 */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-600">📋 프로젝트 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">프로젝트명</div>
              <div className="font-medium">{project.projectName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">현장위치</div>
              <div className="font-medium">{project.location}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">총괄담당자</div>
              <div className="font-medium">{project.generalManager}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">검수자</div>
              <div className="font-medium">{project.inspector}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">검수일자</div>
              <div className="font-medium">{project.inspectionDate || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">업로드일자</div>
              <div className="font-medium">{project.uploadDate}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">최종수정일</div>
              <div className="font-medium">{project.lastModified}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 전체 점수 */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">전체 평가 점수</h2>
          <div className="flex items-baseline space-x-6">
            <div className="text-4xl font-bold text-blue-600">
              {summaryData.전체점수.total}/{summaryData.전체점수.max}
            </div>
            <div className="text-3xl font-semibold text-gray-600">
              ({summaryData.전체점수.percentage}%)
            </div>
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${summaryData.전체점수.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-6">
        {/* 탭 선택 */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setViewMode('category')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'category'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              업무별 집계
            </button>
            <button
              onClick={() => setViewMode('manager')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === 'manager'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              담당자별 집계
            </button>
          </nav>
        </div>

        {/* 업무별 집계 */}
        {viewMode === 'category' && (
          <div className="space-y-4">
            {/* 대분류 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(summaryData.대분류별).map(([category, data]) => {
                const percentage = data.최대점수합 > 0 
                  ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                  : 0;
                
                return (
                  <div 
                    key={category}
                    className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedCategory(category)}
                  >
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{category}</h3>
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {data.점수합}/{data.최대점수합}
                    </div>
                    <div className="text-xl text-gray-600 mb-2">
                      ({percentage}%)
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          percentage >= 90 ? 'bg-green-500' :
                          percentage >= 80 ? 'bg-blue-500' :
                          percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      {data.항목수}개 항목 | {Array.from(data.담당자목록).length}명 담당자
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 선택된 대분류의 중분류 상세 */}
            {selectedCategory && summaryData.대분류별[selectedCategory] && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">
                  {selectedCategory} - 중분류별 상세
                </h3>
                <div className="space-y-3">
                  {Object.entries(summaryData.대분류별[selectedCategory].중분류).map(([중분류, data]) => {
                    const percentage = data.최대점수합 > 0 
                      ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                      : 0;
                    
                    return (
                      <div key={중분류} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-lg font-medium">{중분류}</h4>
                          <div className="flex items-center space-x-4">
                            <span className="text-lg font-semibold">
                              {data.점수합}/{data.최대점수합}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(percentage)}`}>
                              {percentage}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              percentage >= 90 ? 'bg-green-500' :
                              percentage >= 80 ? 'bg-blue-500' :
                              percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        
                        {/* 소분류가 있는 경우 */}
                        {Object.keys(data.소분류 || {}).length > 0 && (
                          <div className="mt-3 ml-4 space-y-1">
                            {Object.entries(data.소분류 || {}).map(([소분류, 소data]) => {
                              const 소percentage = 소data.최대점수합 > 0 
                                ? (소data.점수합 / 소data.최대점수합 * 100).toFixed(1) 
                                : 0;
                              
                              return (
                                <div key={소분류} className="flex justify-between text-sm text-gray-600">
                                  <span>└ {소분류}</span>
                                  <span className="font-medium">
                                    {소data.점수합}/{소data.최대점수합} ({소percentage}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 담당자별 집계 */}
        {viewMode === 'manager' && (
          <div className="space-y-4">
            {/* 담당자 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(summaryData.담당자별).map(([manager, data]) => {
                const percentage = data.최대점수합 > 0 
                  ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                  : 0;
                
                return (
                  <div 
                    key={manager}
                    className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedManager(manager)}
                  >
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{manager}</h3>
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {data.점수합}/{data.최대점수합}
                    </div>
                    <div className="text-xl text-gray-600 mb-2">
                      ({percentage}%)
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          percentage >= 90 ? 'bg-green-500' :
                          percentage >= 80 ? 'bg-blue-500' :
                          percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      {data.항목수}개 항목
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 선택된 담당자의 업무별 상세 */}
            {selectedManager && summaryData.담당자별[selectedManager] && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">
                  {selectedManager} - 업무별 상세
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(summaryData.담당자별[selectedManager].대분류별).map(([대분류, data]) => {
                    const percentage = data.최대점수합 > 0 
                      ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                      : 0;
                    
                    return (
                      <div 
                        key={대분류}
                        className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedManagerCategory(대분류)}
                      >
                        <h4 className="text-md font-semibold text-gray-800 mb-2">{대분류}</h4>
                        <div className="text-2xl font-bold text-blue-600 mb-1">
                          {data.점수합}/{data.최대점수합}
                        </div>
                        <div className="text-lg text-gray-600 mb-2">
                          ({percentage}%)
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              percentage >= 90 ? 'bg-green-500' :
                              percentage >= 80 ? 'bg-blue-500' :
                              percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 중분류별 상세 */}
                {selectedManagerCategory && summaryData.담당자별[selectedManager].대분류별[selectedManagerCategory] && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-lg font-semibold mb-3">
                      {selectedManagerCategory} - 중분류별 상세
                    </h4>
                    <div className="space-y-3">
                      {Object.entries(summaryData.담당자별[selectedManager].대분류별[selectedManagerCategory].중분류별).map(([중분류, data]) => {
                        const percentage = data.최대점수합 > 0 
                          ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                          : 0;
                        
                        return (
                          <div key={중분류} className="border rounded-lg p-3 bg-white">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium">{중분류}</h5>
                              <div className="flex items-center space-x-3">
                                <span className="font-semibold">
                                  {data.점수합}/{data.최대점수합}
                                </span>
                                <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(percentage)}`}>
                                  {percentage}%
                                </span>
                              </div>
                            </div>
                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  percentage >= 90 ? 'bg-green-500' :
                                  percentage >= 80 ? 'bg-blue-500' :
                                  percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            
                            {/* 소분류가 있는 경우 */}
                            {Object.keys(data.소분류별 || {}).length > 0 && (
                              <div className="mt-2 ml-4 space-y-1">
                                {Object.entries(data.소분류별 || {}).map(([소분류, 소data]) => {
                                  const 소percentage = 소data.최대점수합 > 0 
                                    ? (소data.점수합 / 소data.최대점수합 * 100).toFixed(1) 
                                    : 0;
                                  
                                  return (
                                    <div key={소분류} className="flex justify-between text-xs text-gray-600">
                                      <span>└ {소분류}</span>
                                      <span className="font-medium">
                                        {소data.점수합}/{소data.최대점수합} ({소percentage}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}