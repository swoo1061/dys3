'use client';
import { useState, useEffect } from 'react';
import Spreadsheet from "react-spreadsheet";
import { useParams, useRouter } from 'next/navigation';

export default function InspectionSheet() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [projectInfo, setProjectInfo] = useState({
    projectName: "",
    location: "",
    generalManager: "",
    inspector: ""
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjectData();
  }, [params.id]);

  const loadProjectData = async () => {
    try {
      // 프로젝트 정보 가져오기
      const response = await fetch('/api/projects');
      const projects = await response.json();
      const currentProject = projects.find(p => p.id === parseInt(params.id));
      
      if (currentProject) {
        setProject(currentProject);
        
        // 실제 Excel 파일 데이터 로드 시도
        try {
          const excelResponse = await fetch('/api/excel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filePath: currentProject.filePath })
          });
          
          const excelResult = await excelResponse.json();
          
          if (excelResult.success && excelResult.data.length > 0) {
            setData(excelResult.data);
            if (excelResult.projectInfo) {
              setProjectInfo(excelResult.projectInfo);
            }
          } else {
            // Excel 읽기 실패 시 샘플 데이터 사용
            loadSampleData();
          }
        } catch (error) {
          console.error('Excel load error:', error);
          loadSampleData();
        }
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  // 샘플 데이터 로드 함수
  const loadSampleData = () => {
    const sampleData = [
      [
        { value: "대분류" },
        { value: "중분류" },
        { value: "소분류" },
        { value: "임무" },
        { value: "담당자" },
        { value: "체크" },
        { value: "점수" },
        { value: "점수범위" }
      ],
      [
        { value: "현장실측" },
        { value: "도면치수 정확도" },
        { value: "" },
        { value: "실측이 정확히 되었는가?" },
        { value: "담당자A" },
        { value: "✓" },
        { value: 1 },
        { value: "0/1" }
      ],
      [
        { value: "현장실측" },
        { value: "체크리스트" },
        { value: "" },
        { value: "체크리스트 빠짐없이 작성되었는가?" },
        { value: "담당자A" },
        { value: "✓" },
        { value: 1 },
        { value: "0/1" }
      ],
      [
        { value: "도면작성" },
        { value: "설계도면" },
        { value: "평면도" },
        { value: "평면도가 정확한가?" },
        { value: "담당자B" },
        { value: "✓" },
        { value: 4 },
        { value: "0/5" }
      ],
      [
        { value: "도면작성" },
        { value: "설계도면" },
        { value: "입면도" },
        { value: "입면도가 정확한가?" },
        { value: "담당자B" },
        { value: "" },
        { value: 3 },
        { value: "0/5" }
      ],
      [
        { value: "시공관리" },
        { value: "품질관리" },
        { value: "" },
        { value: "품질기준을 준수했는가?" },
        { value: "담당자C" },
        { value: "✓" },
        { value: 2 },
        { value: "0/3" }
      ]
    ];
    setData(sampleData);
    setProjectInfo({
      projectName: project?.projectName || "샘플 프로젝트",
      location: project?.location || "샘플 현장",
      generalManager: "담당자A",
      inspector: "검수자A"
    });
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/excel/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: project.filePath,
          data: data,
          projectInfo: projectInfo
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('저장되었습니다!');
        
        // 프로젝트 최종수정일 업데이트
        await fetch('/api/projects', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: project.id,
            lastModified: new Date().toISOString().split('T')[0]
          })
        });
      } else {
        alert('저장 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  // 점수 계산 함수 (오류 수정)
  const calculateTotalScore = () => {
    if (data.length <= 1) return { total: 0, max: 0, percentage: 0 };
    
    let totalScore = 0;
    let maxScore = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const score = Number(row[6]?.value) || 0;
      const scoreRange = row[7]?.value;
      
      // scoreRange 안전 처리
      let max = 1; // 기본값
      
      if (scoreRange && typeof scoreRange === 'string' && scoreRange.includes('/')) {
        const parts = scoreRange.split('/');
        if (parts.length === 2) {
          max = parseInt(parts[1]) || 1;
        }
      } else if (scoreRange && typeof scoreRange === 'number') {
        // 숫자인 경우 그대로 사용
        max = scoreRange;
      } else if (scoreRange && typeof scoreRange === 'string') {
        // 문자열이지만 '/'가 없는 경우 숫자로 변환 시도
        const numValue = parseInt(scoreRange);
        if (!isNaN(numValue)) {
          max = numValue;
        }
      }
      
      totalScore += score;
      maxScore += max;
    }
    
    return {
      total: totalScore,
      max: maxScore,
      percentage: maxScore > 0 ? (totalScore / maxScore * 100).toFixed(1) : 0
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">로딩 중...</div>
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

  const scoreInfo = calculateTotalScore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {projectInfo.projectName || project.projectName} - 검수 시트
              </h1>
              <div className="text-sm text-gray-500 mt-1 grid grid-cols-2 gap-x-6">
                <div>현장위치: {projectInfo.location || project.location}</div>
                <div>총괄담당자: {projectInfo.generalManager}</div>
                <div>검수자: {projectInfo.inspector}</div>
                <div>검수일자: {projectInfo.inspectionDate}</div>
              </div>
            </div>
            <div className="space-x-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                저장
              </button>
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                목록으로
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 점수 요약 카드 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-2">전체 점수</h3>
          <div className="flex items-baseline space-x-4">
            <div className="text-3xl font-bold text-blue-600">
              {scoreInfo.total}/{scoreInfo.max}
            </div>
            <div className="text-2xl font-semibold text-gray-600">
              ({scoreInfo.percentage}%)
            </div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${scoreInfo.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 스프레드시트 */}
      <main className="max-w-7xl mx-auto px-4 py-2">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="overflow-x-auto">
            <Spreadsheet 
              data={data} 
              onChange={setData}
              columnLabels={["A", "B", "C", "D", "E", "F", "G", "H"]}
            />
          </div>
        </div>
        
        {/* 범례 */}
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">점수 입력 가이드</h4>
          <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
            <div>• 0/1 형식: 0 또는 1만 입력</div>
            <div>• 0/3 형식: 0~3 사이 입력</div>
            <div>• 0/5 형식: 0~5 사이 입력</div>
          </div>
        </div>
      </main>
    </div>
  );
}