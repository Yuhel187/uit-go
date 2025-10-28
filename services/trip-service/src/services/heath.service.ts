const getStatus = () => {
  return { status: 'OK', timestamp: new Date().toISOString() };
};

export default { getStatus };
