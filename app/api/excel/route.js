import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const { filePath } = await request.json();
    
    // 파일 경로 확인
    const fullPath = path.join(process.cwd(), 'public', filePath);
    
    // Excel 파일 읽기
    const fileBuffer = await readFile(fullPath);
    const workbook = XLSX.read(fileBuffer, {
      cellStyles: true,
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });
    
    // 첫 번째 시트 가져오기
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // JSON으로 변환
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,  // 배열 형태로 반환
      defval: "",  // 빈 셀은 빈 문자열로
      raw: false   // 날짜를 문자열로 변환
    });
    
    // 프로젝트 정보 추출 (행 1~5에서 B열 값)
    const projectInfo = {
      projectName: jsonData[1] && jsonData[1][1] ? jsonData[1][1] : "",
      location: jsonData[2] && jsonData[2][1] ? jsonData[2][1] : "",
      generalManager: jsonData[3] && jsonData[3][1] ? jsonData[3][1] : "",
      inspector: jsonData[4] && jsonData[4][1] ? jsonData[4][1] : "",
      inspectionDate: jsonData[5] && jsonData[5][1] ? formatDate(jsonData[5][1]) : ""
    };
    
    // 검수일자 형식 검증 및 변환
    if (projectInfo.inspectionDate) {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(projectInfo.inspectionDate)) {
        // 다양한 날짜 형식 처리
        const parsedDate = parseFlexibleDate(projectInfo.inspectionDate);
        if (parsedDate) {
          projectInfo.inspectionDate = parsedDate;
        } else {
          return NextResponse.json({ 
            success: false, 
            error: '검수일자 형식이 올바르지 않습니다. (yyyy-mm-dd 형식으로 입력해주세요)' 
          }, { status: 400 });
        }
      }
    }
    
    // 헤더 위치 확인 (행 7)
    let headers = [];
    let dataStartRow = 8;
    
    if (jsonData[7] && jsonData[7][0] === "대분류") {
      headers = jsonData[7];
    } else {
      // 헤더를 찾지 못한 경우 기본 헤더 사용
      headers = ["대분류", "중분류", "소분류", "임무", "담당자", "점수", "점수 범위"];
    }
    
    // react-spreadsheet 형식으로 변환
    const formattedData = [];
    
    // 헤더 추가
    formattedData.push(headers.map(header => ({ value: header || "" })));
    
    // 이전 대분류 값 저장 (병합 셀 처리용)
    let prev대분류 = "";
    
    // 데이터 추가 (행 8부터)
    for (let i = dataStartRow; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;
      
      // 모든 셀이 비어있는 행은 건너뛰기
      if (row.every(cell => !cell || cell.toString().trim() === "")) continue;
      
      // 대분류가 비어있으면 이전 값 사용 (병합 셀 처리)
      if (row[0] && row[0].toString().trim() !== "") {
        prev대분류 = row[0].toString().trim();
      }
      
      // 점수 범위 파싱
      let maxScore = 1;
      if (row[6]) {
        const scoreRange = row[6].toString();
        const parts = scoreRange.split('/');
        if (parts.length === 2) {
          maxScore = parseInt(parts[1]) || 1;
        }
      }
      
      // 점수 처리
      let score = 0;
      if (row[5] !== undefined && row[5] !== "") {
        score = parseInt(row[5]) || 0;
      }
      
      const formattedRow = [
        { value: row[0] ? row[0].toString().trim() : prev대분류 }, // 대분류
        { value: row[1] ? row[1].toString().trim() : "" },         // 중분류
        { value: row[2] ? row[2].toString().trim() : "" },         // 소분류
        { value: row[3] ? row[3].toString().trim() : "" },         // 임무
        { value: row[4] ? row[4].toString().trim() : "" },         // 담당자
        { value: score },                                          // 점수
        { value: row[6] ? row[6].toString().trim() : "0/1" },      // 점수범위
        { value: maxScore }                                        // 최대점수 (숨김 데이터)
      ];
      
      formattedData.push(formattedRow);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: formattedData,
      projectInfo: projectInfo,
      sheetName: sheetName
    });
    
  } catch (error) {
    console.error('Excel read error:', error);
    return NextResponse.json({ 
      success: false, 
      error: `파일을 읽을 수 없습니다: ${error.message}` 
    }, { status: 500 });
  }
}

// 날짜 형식을 yyyy-mm-dd로 변환
function formatDate(dateValue) {
  if (!dateValue) return "";
  
  // 이미 올바른 형식인지 확인
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return "";
    }
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return "";
  }
}

// 다양한 날짜 형식을 처리하는 함수
function parseFlexibleDate(dateString) {
  if (!dateString) return null;
  
  // 공통 패턴들
  const patterns = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,     // 2025-6-3
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,  // 6/3/25 또는 6/3/2025
    /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,   // 6-3-25
    /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/  // 6.3.25
  ];
  
  for (const pattern of patterns) {
    const match = dateString.match(pattern);
    if (match) {
      let year, month, day;
      
      if (pattern.source.startsWith('^(\\d{4})')) {
        // yyyy-mm-dd 형식
        [, year, month, day] = match;
      } else {
        // mm/dd/yy 형식들
        [, month, day, year] = match;
        
        // 2자리 연도를 4자리로 변환
        if (year.length === 2) {
          const currentYear = new Date().getFullYear();
          const currentCentury = Math.floor(currentYear / 100) * 100;
          year = parseInt(year) <= 50 ? currentCentury + parseInt(year) : currentCentury - 100 + parseInt(year);
        }
      }
      
      // 유효한 날짜인지 확인
      const dateObj = new Date(year, month - 1, day);
      if (dateObj.getFullYear() == year && 
          dateObj.getMonth() == month - 1 && 
          dateObj.getDate() == day) {
        
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }
  }
  
  return null;
}