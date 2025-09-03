import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { IconButton } from 'react-native-paper';
import ImageViewer from 'react-native-image-zoom-viewer';

const MediaViewer = ({ visible, images, onClose, index = 0 }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <ImageViewer
          imageUrls={images}
          index={index}
          onSwipeDown={onClose}
          enableSwipeDown
          saveToLocalByLongPress={false}
        />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <IconButton icon="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 999,
  },
});

export default MediaViewer;
