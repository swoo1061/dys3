import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'projects.json');

// 데이터 디렉토리 및 파일 초기화
async function initializeData() {
  try {
    // data 디렉토리 생성 (없으면)
    await mkdir(dataDir, { recursive: true });
    
    // projects.json 파일이 없으면 빈 배열로 생성
    try {
      await readFile(dataFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        await writeFile(dataFile, JSON.stringify([], null, 2));
      }
    }
  } catch (error) {
    console.error('데이터 초기화 오류:', error);
  }
}

// 프로젝트 데이터 읽기
async function readProjects() {
  try {
    await initializeData();
    const data = await readFile(dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('프로젝트 읽기 오류:', error);
    return [];
  }
}

// 프로젝트 데이터 저장
async function writeProjects(projects) {
  try {
    await initializeData();
    await writeFile(dataFile, JSON.stringify(projects, null, 2));
    return true;
  } catch (error) {
    console.error('프로젝트 저장 오류:', error);
    return false;
  }
}

// 파일 삭제 함수
async function deleteProjectFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), 'public', filePath);
    await unlink(fullPath);
    console.log('파일 삭제 완료:', filePath);
    return true;
  } catch (error) {
    console.error('파일 삭제 오류:', error);
    // 파일이 없어도 프로젝트 데이터는 삭제하도록 함
    return false;
  }
}

// GET 요청 - 프로젝트 목록 가져오기
export async function GET() {
  const projects = await readProjects();
  return NextResponse.json(projects);
}

// POST 요청 - 새 프로젝트 추가
export async function POST(request) {
  try {
    const newProject = await request.json();
    const projects = await readProjects();
    
    projects.push(newProject);
    
    const success = await writeProjects(projects);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      throw new Error('프로젝트 저장 실패');
    }
  } catch (error) {
    console.error('프로젝트 추가 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// PUT 요청 - 프로젝트 수정
export async function PUT(request) {
  try {
    const { id, ...updateData } = await request.json();
    const projects = await readProjects();
    
    const projectIndex = projects.findIndex(p => p.id === id);
    
    if (projectIndex !== -1) {
      projects[projectIndex] = { ...projects[projectIndex], ...updateData };
      
      const success = await writeProjects(projects);
      
      if (success) {
        return NextResponse.json({ success: true });
      } else {
        throw new Error('프로젝트 수정 저장 실패');
      }
    } else {
      return NextResponse.json({ 
        success: false, 
        error: '프로젝트를 찾을 수 없습니다' 
      }, { status: 404 });
    }
  } catch (error) {
    console.error('프로젝트 수정 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// DELETE 요청 - 프로젝트 삭제 (파일도 함께 삭제)
export async function DELETE(request) {
  try {
    const { id } = await request.json();
    const projects = await readProjects();
    
    // 삭제할 프로젝트 찾기
    const projectToDelete = projects.find(p => p.id === id);
    
    if (!projectToDelete) {
      return NextResponse.json({ 
        success: false, 
        error: '프로젝트를 찾을 수 없습니다' 
      }, { status: 404 });
    }
    
    // 관련 파일 삭제
    if (projectToDelete.filePath) {
      await deleteProjectFile(projectToDelete.filePath);
    }
    
    // 프로젝트 데이터에서 삭제
    const filteredProjects = projects.filter(p => p.id !== id);
    
    const success = await writeProjects(filteredProjects);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      throw new Error('프로젝트 삭제 저장 실패');
    }
  } catch (error) {
    console.error('프로젝트 삭제 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}