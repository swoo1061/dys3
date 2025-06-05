// components/FileUpload.js - 파일 업로드 컴포넌트
import { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaFileExcel, FaSpinner, FaCheck, FaTimes } from 'react-icons/fa';

// 상수 정의
const CONSTANTS = {
  UPLOAD_PROGRESS: {
    START: 0,
    MIDDLE: 90,
    COMPLETE: 100
  },
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls']
  },
  PROGRESS_STEP: 10,
  PROGRESS_INTERVAL: 200
};

// 유틸리티 함수
const utils = {
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  formatDate: (date) => {
    return new Date(date).toLocaleString();
  },
  
  validateFile: (file) => {
    if (!file) return false;
    if (file.size > CONSTANTS.MAX_FILE_SIZE) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.');
      return false;
    }
    return true;
  }
};

export default function FileUpload({ onUploadComplete }) {
  const [uploadHistory, setUploadHistory] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // 업로드 히스토리 업데이트 최적화
  const updateUploadHistory = useCallback((newHistory) => {
    setUploadHistory(prev => {
      const updated = [...prev, {
        ...newHistory,
        uploader: '관리자',
        date: new Date().toLocaleString()
      }];
      return updated.slice(-5); // 최근 5개만 유지
    });
  }, []);

  // 에러 처리 최적화
  const handleError = useCallback((error, file) => {
    console.error('Upload error:', error);
    updateUploadHistory({
      fileName: file.name,
      projectName: '-',
      uploader: '김과장',
      size: utils.formatFileSize(file.size),
      status: '❌',
      note: error.message || '업로드 실패'
    });
  }, [updateUploadHistory]);

  // 파일 드롭 핸들러 최적화
  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    let progressInterval;

    try {
      utils.validateFile(file);
      setIsUploading(true);
      setUploadProgress(CONSTANTS.UPLOAD_PROGRESS.START);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectName', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('uploader', '김과장');

      // 업로드 진행 상태 시뮬레이션 최적화
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= CONSTANTS.UPLOAD_PROGRESS.MIDDLE) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + CONSTANTS.PROGRESS_STEP;
        });
      }, CONSTANTS.PROGRESS_INTERVAL);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('업로드 실패');
      }

      const result = await response.json();
      clearInterval(progressInterval);
      setUploadProgress(CONSTANTS.UPLOAD_PROGRESS.COMPLETE);
      
      const successHistory = {
        fileName: file.name,
        projectName: result.projectName || '-',
        uploader: '김과장',
        size: utils.formatFileSize(file.size),
        status: '✅',
        note: '성공'
      };
      updateUploadHistory(successHistory);
      onUploadComplete?.();
    } catch (error) {
      handleError(error, file);
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onUploadComplete, updateUploadHistory, handleError]);

  // 드롭존 설정 최적화
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: CONSTANTS.ALLOWED_TYPES,
    maxSize: CONSTANTS.MAX_FILE_SIZE,
    multiple: false
  });

  // 드롭존 스타일 최적화
  const dropzoneStyle = useMemo(() => ({
    border: `2px dashed ${isDragActive ? '#3b82f6' : '#e5e7eb'}`,
    backgroundColor: isDragActive ? '#f0f9ff' : 'white',
    transition: 'all 0.2s ease'
  }), [isDragActive]);

  return (
    <div className="space-y-6">
      {/* 파일 업로드 영역 */}
      <div
        {...getRootProps()}
        style={dropzoneStyle}
        className="p-8 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors"
      >
        <input {...getInputProps()} />
        <FaFileExcel className="mx-auto text-4xl text-green-500 mb-4" />
        <p className="text-gray-600">
          {isDragActive
            ? '파일을 여기에 놓으세요'
            : 'Excel 파일을 드래그하거나 클릭하여 업로드하세요'}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          지원 형식: .xlsx, .xls (최대 10MB)
        </p>
      </div>

      {/* 업로드 진행 상태 */}
      {isUploading && (
        <div className="space-y-2">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 text-center">
            {uploadProgress === 100 ? (
              <span className="flex items-center justify-center">
                <FaCheck className="text-green-500 mr-2" />
                업로드 완료
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                업로드 중... {uploadProgress}%
              </span>
            )}
          </p>
        </div>
      )}

      {/* 업로드 히스토리 */}
      {uploadHistory.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">업로드 히스토리</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 border-b text-left">업로드일</th>
                  <th className="px-4 py-2 border-b text-left">파일명</th>
                  <th className="px-4 py-2 border-b text-left">감리</th>
                  <th className="px-4 py-2 border-b text-left">업로더</th>
                  <th className="px-4 py-2 border-b text-left">크기</th>
                  <th className="px-4 py-2 border-b text-left">상태</th>
                  <th className="px-4 py-2 border-b text-left">비고</th>
                </tr>
              </thead>
              <tbody>
                {uploadHistory.map((history) => (
                  <tr key={history.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b">{history.date}</td>
                    <td className="px-4 py-2 border-b">{history.fileName}</td>
                    <td className="px-4 py-2 border-b">{history.projectName}</td>
                    <td className="px-4 py-2 border-b">{history.uploader}</td>
                    <td className="px-4 py-2 border-b">{history.size}</td>
                    <td className="px-4 py-2 border-b">{history.status}</td>
                    <td className="px-4 py-2 border-b">{history.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}