from calculator import add, subtract


def test_adds_two_numbers():
    assert add(2, 3) == 5


def test_subtracts_two_numbers():
    assert subtract(7, 4) == 3
