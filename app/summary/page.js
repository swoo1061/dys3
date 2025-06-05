'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Summary() {
  const router = useRouter();
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
  const [selectedProject, setSelectedProject] = useState(null);
  const [periodFilter, setPeriodFilter] = useState('all'); // 'all', '1year', '6months', '3months', '2months', '1month', 'custom'
  const [filteredData, setFilteredData] = useState([]);
  
  // 커스텀 날짜 필터 상태 추가
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  useEffect(() => {
    loadSummaryData();
  }, [periodFilter, customStartDate, customEndDate]);

  const loadSummaryData = async () => {
    try {
      // 모든 프로젝트 가져오기
      const projectsRes = await fetch('/api/projects');
      const projects = await projectsRes.json();
      
      // 기간 필터링
      const now = new Date();
      let startDate = null;
      let endDate = now;
      
      switch (periodFilter) {
        case '1year':
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case '6months':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case '3months':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '2months':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 2);
          break;
        case '1month':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            startDate = new Date(customStartDate);
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999); // 종료일 포함
          }
          break;
        default:
          startDate = null;
      }
      
      // 프로젝트 필터링 - 검수일자 기준
      const filteredProjects = startDate 
        ? projects.filter(p => {
            if (!p.inspectionDate) return false;
            const inspectionDate = new Date(p.inspectionDate);
            return inspectionDate >= startDate && inspectionDate <= endDate;
          })
        : projects;
      
      const allData = [];
      let totalScore = 0;
      let totalMaxScore = 0;
      
      // 각 프로젝트의 데이터 읽기
      for (const project of filteredProjects) {
        try {
          const excelRes = await fetch('/api/excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: project.filePath })
          });
          
          const excelData = await excelRes.json();
          
          if (excelData.success && excelData.data && excelData.data.length > 1) {
            // 헤더 제외하고 데이터 처리
            let prev대분류 = "";
            
            for (let i = 1; i < excelData.data.length; i++) {
              const row = excelData.data[i];
              if (!row || row.length === 0) continue;
              
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
              
              allData.push({
                project: excelData.projectInfo?.projectName || project.projectName,
                대분류: row[0]?.value || prev대분류,
                중분류: row[1]?.value || '',
                소분류: row[2]?.value || '',
                임무: row[3]?.value || '',
                담당자: row[4]?.value || '',
                점수: score,
                최대점수: maxScore,
                점수범위: `${scoreRange.min}/${scoreRange.max}`
              });
            }
          }
        } catch (error) {
          console.error(`Error loading ${project.projectName}:`, error);
        }
      }
      
      setFilteredData(allData);
      
      // 데이터 집계
      const summary = calculateSummary(allData);
      summary.전체점수 = {
        total: totalScore,
        max: totalMaxScore,
        percentage: totalMaxScore > 0 ? (totalScore / totalMaxScore * 100).toFixed(1) : 0
      };
      
      setSummaryData(summary);
    } catch (error) {
      console.error('Failed to load summary:', error);
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

  const calculateSummary = (data) => {
    const summary = {
      대분류별: {},
      중분류별: {},
      담당자별: {}
    };
    
    data.forEach(item => {
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
          프로젝트목록: new Set(),
          대분류별: {},
          프로젝트별: {}
        };
      }
      summary.담당자별[item.담당자].점수합 += item.점수;
      summary.담당자별[item.담당자].최대점수합 += item.최대점수;
      summary.담당자별[item.담당자].항목수 += 1;
      summary.담당자별[item.담당자].프로젝트목록.add(item.project);
      
      // 담당자별 대분류별 집계
      if (!summary.담당자별[item.담당자].대분류별[item.대분류]) {
        summary.담당자별[item.담당자].대분류별[item.대분류] = {
          점수합: 0,
          최대점수합: 0,
          중분류별: {},
          프로젝트별: {}
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
      
      // 담당자별 프로젝트별 대분류별 집계
      if (!summary.담당자별[item.담당자].프로젝트별[item.project]) {
        summary.담당자별[item.담당자].프로젝트별[item.project] = {
          대분류별: {}
        };
      }
      
      if (!summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류]) {
        summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류] = {
          점수합: 0,
          최대점수합: 0,
          중분류별: {}
        };
      }
      summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].점수합 += item.점수;
      summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].최대점수합 += item.최대점수;
      
      if (!summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].중분류별[item.중분류]) {
        summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].중분류별[item.중분류] = {
          점수합: 0,
          최대점수합: 0,
          소분류별: {}
        };
      }
      summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].중분류별[item.중분류].점수합 += item.점수;
      summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].중분류별[item.중분류].최대점수합 += item.최대점수;
      
      if (item.소분류) {
        if (!summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류]) {
          summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류] = {
            점수합: 0,
            최대점수합: 0
          };
        }
        summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류].점수합 += item.점수;
        summary.담당자별[item.담당자].프로젝트별[item.project].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류].최대점수합 += item.최대점수;
      }
    });
    
    return summary;
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 80) return 'text-blue-600 bg-blue-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getDateRange = () => {
    if (periodFilter === 'custom' && customStartDate && customEndDate) {
      return `${customStartDate} ~ ${customEndDate}`;
    }

    const now = new Date();
    let startDate = null;
    
    switch (periodFilter) {
      case '1year':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case '6months':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '3months':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '2months':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case '1month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        return '';
    }
    
    if (startDate) {
      const formatDate = (date) => {
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      return `${formatDate(startDate)} ~ ${formatDate(now)}`;
    }
    
    return '';
  };

  const handlePeriodChange = (period) => {
    setPeriodFilter(period);
    if (period === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const applyCustomDateFilter = () => {
    if (customStartDate && customEndDate) {
      setPeriodFilter('custom');
      setShowCustomDatePicker(false);
    } else {
      alert('시작일과 종료일을 모두 입력해주세요.');
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              업무 평가 집계표
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

      {/* 기간 필터 */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-wrap items-center space-x-1 gap-y-2">
            <button
              onClick={() => handlePeriodChange('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                periodFilter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => handlePeriodChange('1year')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                periodFilter === '1year'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              1년
            </button>
            <button
              onClick={() => handlePeriodChange('6months')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                periodFilter === '6months'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              6개월
            </button>
            <button
              onClick={() => handlePeriodChange('3months')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                periodFilter === '3months'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              3개월
            </button>
            <button
              onClick={() => handlePeriodChange('2months')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                periodFilter === '2months'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              2개월
            </button>
            <button
              onClick={() => handlePeriodChange('1month')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                periodFilter === '1month'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              1개월
            </button>
            <button
              onClick={() => handlePeriodChange('custom')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                periodFilter === 'custom'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 기간 선택
            </button>
          </div>
          <div className="text-sm text-gray-500">
            {getDateRange()}
          </div>
        </div>

        {/* 커스텀 날짜 선택기 */}
        {showCustomDatePicker && (
          <div className="mb-4 p-4 bg-white rounded-lg shadow border">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시작일
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  종료일
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-2 mt-6">
                <button
                  onClick={applyCustomDateFilter}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  적용
                </button>
                <button
                  onClick={() => setShowCustomDatePicker(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            {/* 선택된 대분류의 담당자별 점수 */}
            {selectedCategory && summaryData.대분류별[selectedCategory] && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">
                  {selectedCategory} - 담당자별 점수
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                  {Object.entries(summaryData.담당자별).map(([manager, managerData]) => {
                    // 해당 대분류에 대한 담당자의 점수 찾기
                    const categoryData = managerData.대분류별[selectedCategory];
                    if (!categoryData) return null;
                    
                    const percentage = categoryData.최대점수합 > 0 
                      ? (categoryData.점수합 / categoryData.최대점수합 * 100).toFixed(1) 
                      : 0;
                    
                    return (
                      <div 
                        key={manager}
                        className="bg-white border border-gray-200 rounded p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setSelectedCategoryManager(manager)}
                      >
                        <div className="text-xs font-medium text-gray-700 mb-1 truncate" title={manager}>
                          {manager}
                        </div>
                        <div className="text-sm font-bold text-blue-600">
                          {categoryData.점수합}/{categoryData.최대점수합}
                        </div>
                        <div className="text-xs text-gray-500 mb-1">
                          ({percentage}%)
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 선택된 대분류의 중분류 상세 */}
            {selectedCategory && summaryData.대분류별[selectedCategory] && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-1">
                  {selectedCategory} - 중분류별 상세
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {selectedCategoryManager ? `담당자: ${selectedCategoryManager}` : '전체 담당자 합산'}
                </p>
                <div className="space-y-3">
                  {(() => {
                    const dataSource = selectedCategoryManager 
                      ? summaryData.담당자별[selectedCategoryManager]?.대분류별[selectedCategory]?.중분류별 || {}
                      : summaryData.대분류별[selectedCategory].중분류;
                    
                    return Object.entries(dataSource).map(([중분류, data]) => {
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
                          {Object.keys(data.소분류 || data.소분류별 || {}).length > 0 && (
                            <div className="mt-3 ml-4 space-y-1">
                              {Object.entries(data.소분류 || data.소분류별 || {}).map(([소분류, 소data]) => {
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
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 담당자별 집계 */}
        {viewMode === 'manager' && (
          <div className="space-y-4">
            {/* 담당자 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      {data.항목수}개 항목 | {Array.from(data.프로젝트목록).length}개 프로젝트
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 선택된 담당자의 업무별 상세 */}
            {selectedManager && summaryData.담당자별[selectedManager] && (
              <div className="space-y-4">
                {/* 대분류 카드 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-semibold mb-4">
                    {selectedManager} - 업무별 상세
                  </h3>
                  <div className="mb-4">
                    <span className="text-sm text-gray-600">참여 프로젝트: </span>
                    <span className="text-sm font-medium">
                      {Array.from(summaryData.담당자별[selectedManager].프로젝트목록).join(', ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(summaryData.담당자별[selectedManager].대분류별).map(([대분류, data]) => {
                      const percentage = data.최대점수합 > 0 
                        ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                        : 0;
                      
                      return (
                        <div 
                          key={대분류}
                          className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            setSelectedManagerCategory(대분류);
                            setSelectedProject(null);
                          }}
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
                </div>

                {/* 프로젝트별 상세 */}
                {selectedManagerCategory && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <h3 className="text-xl font-semibold mb-4">
                      {selectedManagerCategory} - 프로젝트별 점수
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                      {Array.from(summaryData.담당자별[selectedManager].프로젝트목록).map((project) => {
                        const projectData = summaryData.담당자별[selectedManager].프로젝트별[project];
                        if (!projectData || !projectData.대분류별[selectedManagerCategory]) return null;
                        
                        const data = projectData.대분류별[selectedManagerCategory];
                        const percentage = data.최대점수합 > 0 
                          ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                          : 0;
                        
                        return (
                          <div 
                            key={project}
                            className="bg-white border border-gray-200 rounded p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setSelectedProject(project)}
                          >
                            <div className="text-xs font-medium text-gray-700 mb-1 truncate" title={project}>
                              {project}
                            </div>
                            <div className="text-sm font-bold text-blue-600">
                              {data.점수합}/{data.최대점수합}
                            </div>
                            <div className="text-xs text-gray-500 mb-1">
                              ({percentage}%)
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
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 중분류별 상세 */}
                {selectedManagerCategory && summaryData.담당자별[selectedManager].대분류별[selectedManagerCategory] && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <h3 className="text-xl font-semibold mb-1">
                      {selectedManagerCategory} - 중분류별 상세
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {selectedProject ? `프로젝트: ${selectedProject}` : '전체 프로젝트 합산'}
                    </p>
                    <div className="space-y-3">
                      {(() => {
                        const dataSource = selectedProject 
                          ? summaryData.담당자별[selectedManager].프로젝트별[selectedProject]?.대분류별[selectedManagerCategory]?.중분류별 || {}
                          : summaryData.담당자별[selectedManager].대분류별[selectedManagerCategory].중분류별;
                        
                        return Object.entries(dataSource).map(([중분류, data]) => {
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
                              {Object.keys(data.소분류별 || {}).length > 0 && (
                                <div className="mt-3 ml-4 space-y-1">
                                  {Object.entries(data.소분류별 || {}).map(([소분류, 소data]) => {
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
                        });
                      })()}
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