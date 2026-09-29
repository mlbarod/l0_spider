export const getRoleOption = (role) => ({ label: role === "master" ? "마스터" : "일반유저" })
export const getRolePolicy = (role) => ({ canChangeQnaStatus: role === "master", canMarkFinalAnswer: role === "master" })
