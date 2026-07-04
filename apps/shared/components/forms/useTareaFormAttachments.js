import { useCallback } from 'react';

export function useTareaFormAttachments(setFormData) {
  const handleFileChange = useCallback((event) => {
    const files = Array.from(event.target.files);
    const newFiles = files.map((file) => ({
      nombre: file.name,
      tipo: file.type,
      url: URL.createObjectURL(file),
    }));

    setFormData((prev) => ({
      ...prev,
      archivos: [...(prev.archivos || []), ...newFiles],
    }));
  }, [setFormData]);

  const removeFile = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      archivos: (prev.archivos || []).filter((_, i) => i !== index),
    }));
  }, [setFormData]);

  return { handleFileChange, removeFile };
}
