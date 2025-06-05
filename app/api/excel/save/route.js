import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const { filePath, data, projectInfo } = await request.json();
    
    // 새 워크북 생성
    const wb = XLSX.utils.book_new();
    
    // 프로젝트 정보를 포함한 전체 데이터 배열 생성
    const fullData = [
      [], // 빈 행 (행 0)
      ["프로젝트명:", projectInfo?.projectName || ""], // 행 1
      ["현장(도시군구):", projectInfo?.location || ""], // 행 2  
      ["총괄담당자:", projectInfo?.generalManager || ""], // 행 3
      ["검수자:", projectInfo?.inspector || ""], // 행 4
      ["검수일자:", projectInfo?.inspectionDate || ""], // 행 5
      [], // 빈 행 (행 6)
    ];
    
    // 검수 데이터 추가 (react-spreadsheet 형식을 일반 배열로 변환)
    const inspectionData = data.map(row => 
      row.map((cell, index) => {
        // 마지막 열(최대점수)은 제외
        if (index >= 7) return undefined;
        return cell.value !== undefined ? cell.value : "";
      }).filter(cell => cell !== undefined)
    );
    
    fullData.push(...inspectionData); // 행 7부터 검수 데이터
    
    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(fullData);
    
    // 셀 병합 설정 (원본 양식과 동일하게)
    const merges = [];
    
    // 대분류 병합 셀 생성
    let currentCategory = "";
    let categoryStartRow = -1;
    
    for (let i = 8; i < fullData.length; i++) { // 데이터 시작 행부터
      const row = fullData[i];
      if (row && row[0]) { // 대분류가 있는 행
        if (currentCategory && categoryStartRow !== -1 && i > categoryStartRow + 1) {
          // 이전 대분류 병합
          merges.push({
            s: { c: 0, r: categoryStartRow },
            e: { c: 0, r: i - 1 }
          });
        }
        currentCategory = row[0];
        categoryStartRow = i;
      }
    }
    
    // 마지막 대분류 병합
    if (currentCategory && categoryStartRow !== -1 && fullData.length > categoryStartRow + 1) {
      merges.push({
        s: { c: 0, r: categoryStartRow },
        e: { c: 0, r: fullData.length - 1 }
      });
    }
    
    ws['!merges'] = merges;
    
    // 열 너비 설정 (원본과 유사하게)
    ws['!cols'] = [
      { wch: 15 },  // A: 대분류
      { wch: 26 },  // B: 중분류  
      { wch: 32 },  // C: 소분류
      { wch: 88 },  // D: 임무
      { wch: 8 },   // E: 담당자
      { wch: 8 },   // F: 점수
      { wch: 10 }   // G: 점수범위
    ];
    
    // 인쇄 영역 설정
    const lastRow = fullData.length;
    ws['!printArea'] = `A8:G${lastRow}`;
    
    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(wb, ws, "업무 메뉴얼");
    
    // Excel 파일로 저장
    const buffer = XLSX.write(wb, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellStyles: true
    });
    
    const fullPath = path.join(process.cwd(), 'public', filePath);
    await writeFile(fullPath, buffer);
    
    return NextResponse.json({ 
      success: true,
      message: "파일이 성공적으로 저장되었습니다."
    });
    
  } catch (error) {
    console.error('Save error:', error);
    return NextResponse.json({ 
      success: false, 
      error: `저장 중 오류가 발생했습니다: ${error.message}` 
    }, { status: 500 });
  }
}