import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    // 프로젝트 정보 가져오기
    const projectsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/projects`);
    const projects = await projectsResponse.json();
    
    const project = projects.find(p => p.id === parseInt(id));
    
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다' }, { status: 404 });
    }
    
    // 파일 경로
    const filePath = path.join(process.cwd(), 'public', project.filePath);
    
    try {
      // 파일 읽기
      const fileBuffer = await readFile(filePath);
      
      // 파일명 설정 (한글 파일명 지원)
      const filename = `${project.projectName}.xlsx`;
      const encodedFilename = encodeURIComponent(filename);
      
      // Response 헤더 설정
      const headers = new Headers();
      headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      headers.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);
      headers.set('Content-Length', fileBuffer.length.toString());
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: headers
      });
      
    } catch (fileError) {
      console.error('파일 읽기 오류:', fileError);
      return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
    }
    
  } catch (error) {
    console.error('다운로드 오류:', error);
    return NextResponse.json({ error: '다운로드 실패' }, { status: 500 });
  }
}