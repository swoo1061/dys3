import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import * as XLSX from 'xlsx';
import path from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 파일명 안전하게 변경 (공백을 _로)
    const filename = file.name.replaceAll(" ", "_");
    const filepath = path.join(process.cwd(), "public/uploads", filename);
    
    // 파일 저장
    await writeFile(filepath, buffer);
    
    // Excel 파일 내용 읽기
    let projectInfo = {
      id: Date.now(),
      projectName: filename.replace('.xlsx', '').replace('.xls', ''),
      location: "위치 미정",
      generalManager: "담당자 미정",
      inspector: "검수자 미정",
      inspectionDate: "",
      uploadDate: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
      filePath: `/uploads/${filename}`
    };

    try {
      // Excel 파일에서 프로젝트 정보 추출
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // JSON으로 변환
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,  // 배열 형태로 반환
        defval: ""  // 빈 셀은 빈 문자열로
      });
      
      // 디버깅을 위한 로그
      console.log('Excel 데이터 구조:', jsonData.slice(0, 10));
      
      // 프로젝트 정보 추출
      const extractedInfo = {
        projectName: jsonData[1] && jsonData[1][1] ? jsonData[1][1] : projectInfo.projectName,
        location: jsonData[2] && jsonData[2][1] ? jsonData[2][1] : projectInfo.location,
        generalManager: jsonData[3] && jsonData[3][1] ? jsonData[3][1] : projectInfo.generalManager,
        inspector: jsonData[4] && jsonData[4][1] ? jsonData[4][1] : projectInfo.inspector,
        inspectionDate: ""
      };
      
      // 검수일자 처리 (여러 형태의 날짜 데이터 처리)
      let rawDate = jsonData[5] && jsonData[5][1] ? jsonData[5][1] : null;
      console.log('원본 검수일자 데이터:', rawDate, '타입:', typeof rawDate);
      
      if (rawDate) {
        let formattedDate = "";
        
        if (typeof rawDate === 'number') {
          // Excel의 날짜는 숫자로 저장될 수 있음 (1900년 1월 1일부터의 일수)
          const excelDate = new Date((rawDate - 25569) * 86400 * 1000);
          if (!isNaN(excelDate.getTime())) {
            formattedDate = excelDate.toISOString().split('T')[0];
          }
        } else if (typeof rawDate === 'string') {
          // 문자열 날짜 처리
          const cleanedDate = rawDate.trim();
          
          // yyyy-mm-dd 형식인지 확인
          if (/^\d{4}-\d{2}-\d{2}$/.test(cleanedDate)) {
            const testDate = new Date(cleanedDate);
            if (!isNaN(testDate.getTime())) {
              formattedDate = cleanedDate;
            }
          }
          // yyyy/mm/dd 형식 변환
          else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(cleanedDate)) {
            const testDate = new Date(cleanedDate);
            if (!isNaN(testDate.getTime())) {
              formattedDate = testDate.toISOString().split('T')[0];
            }
          }
          // yyyy.mm.dd 형식 변환
          else if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(cleanedDate)) {
            const dateParts = cleanedDate.split('.');
            const testDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            if (!isNaN(testDate.getTime())) {
              formattedDate = testDate.toISOString().split('T')[0];
            }
          }
          // 기타 Date 생성자로 파싱 시도
          else {
            const testDate = new Date(cleanedDate);
            if (!isNaN(testDate.getTime())) {
              formattedDate = testDate.toISOString().split('T')[0];
            }
          }
        } else if (rawDate instanceof Date) {
          // Date 객체인 경우
          if (!isNaN(rawDate.getTime())) {
            formattedDate = rawDate.toISOString().split('T')[0];
          }
        }
        
        extractedInfo.inspectionDate = formattedDate;
        console.log('변환된 검수일자:', formattedDate);
      }
      
      // 추출된 정보로 업데이트
      projectInfo = { ...projectInfo, ...extractedInfo };
      
    } catch (excelError) {
      console.warn('Excel 파일 읽기 실패, 기본값 사용:', excelError);
      // Excel 읽기 실패해도 파일은 업로드되고 기본값으로 프로젝트 생성
    }
    
    // 프로젝트 목록에 추가
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectInfo)
    });
    
    if (!response.ok) {
      throw new Error('프로젝트 정보 저장 실패');
    }
    
    return NextResponse.json({ 
      success: true, 
      project: projectInfo
    });
      
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: "업로드 실패: " + error.message 
    }, { status: 500 });
  }
}